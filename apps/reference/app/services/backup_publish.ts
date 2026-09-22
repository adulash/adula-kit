import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileHash, snapshotFiles } from '#services/backup_snapshot'

export interface SnapshotTransport {
  exists(): Promise<boolean>
  put(name: string, file?: string): Promise<void>
  read(name: string): Promise<AsyncIterable<Uint8Array>>
}

/** A remote completion marker is a commit: no success marker on partial/corrupt transfer. */
export async function publishSnapshot(directory: string, transport: SnapshotTransport) {
  if (await transport.exists()) throw new Error('Refusing to overwrite a complete offsite snapshot')
  for (const name of [...snapshotFiles, 'SHA256SUMS']) {
    const path = join(directory, name)
    await transport.put(name, path)
    const hash = createHash('sha256')
    for await (const chunk of await transport.read(name)) hash.update(chunk)
    if (hash.digest('hex') !== (await fileHash(path)))
      throw new Error(`Offsite checksum mismatch: ${name}`)
  }
  await transport.put('COMPLETE')
  if (!(await transport.exists())) throw new Error('Offsite completion marker is missing')
}
