import type { Readable } from 'node:stream'
import type { Knex } from 'knex'

/** The subset of a Drive disk the migration needs; keeps the kit independent of flydrive. */
export type StorageDisk = {
  exists(key: string): Promise<boolean>
  getStream(key: string): Promise<Readable>
  putStream(key: string, contents: Readable): Promise<void>
  getMetaData(key: string): Promise<{ contentLength: number }>
}
export type StorageMigrationOptions = {
  from: string
  to: string
  disks: readonly string[]
  use: (name: string) => StorageDisk
  dryRun?: boolean
  report?: (line: string) => void
}
export type StorageMigrationResult = {
  from: string
  to: string
  dryRun: boolean
  total: number
  copied: number
  skipped: number
  failed: { id: number; path: string; reason: string }[]
  remaining: number
}

/**
 * Copies every live attachment file to the target disk, verifies its size and
 * repoints the row in its own statement. Rerunning after an interruption only
 * touches rows still on the source disk; source files are never deleted here.
 */
export async function migrateStorage(
  db: Knex,
  options: StorageMigrationOptions
): Promise<StorageMigrationResult> {
  for (const name of [options.from, options.to])
    if (!options.disks.includes(name)) throw new Error(`Unknown disk: ${name}`)
  if (options.from === options.to) throw new Error('Source and target disks must differ')
  const rows: { id: number; path: string; size: string | number }[] = await db('attachments')
    .where('disk', options.from)
    .whereNull('deleted_at')
    .orderBy('id')
    .select('id', 'path', 'size')
  const result: StorageMigrationResult = {
    from: options.from,
    to: options.to,
    dryRun: Boolean(options.dryRun),
    total: rows.length,
    copied: 0,
    skipped: 0,
    failed: [],
    remaining: rows.length,
  }
  const report = options.report ?? (() => {})
  if (options.dryRun) {
    for (const row of rows) report(`would copy #${row.id} ${row.path} (${row.size} bytes)`)
    return result
  }
  const source = options.use(options.from)
  const target = options.use(options.to)
  for (const row of rows) {
    const size = Number(row.size)
    try {
      let present = false
      if (await target.exists(row.path)) {
        const existing = await target.getMetaData(row.path)
        present = existing.contentLength === size
      }
      if (!present) {
        await target.putStream(row.path, await source.getStream(row.path))
        const written = await target.getMetaData(row.path)
        if (written.contentLength !== size)
          throw new Error(
            `size mismatch after copy: expected ${size}, found ${written.contentLength}`
          )
      }
      await db.transaction((trx) =>
        trx('attachments').where({ id: row.id, disk: options.from }).update({ disk: options.to })
      )
      if (present) result.skipped++
      else result.copied++
      result.remaining--
      report(`${present ? 'verified' : 'copied'} #${row.id} ${row.path}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      result.failed.push({ id: Number(row.id), path: row.path, reason })
      report(`failed #${row.id} ${row.path}: ${reason}`)
    }
  }
  return result
}
