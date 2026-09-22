import type { Knex } from 'knex'
import { Settings, notify } from './settings.js'

export type BackupObject = { key: string; size: number; modifiedAt: string }
export type BackupStatus = { healthy: boolean; reason: string; checkedAt: string }

/** Check one complete recent snapshot; object existence is not a restore test. */
export function assessBackup(
  objects: BackupObject[],
  now = Date.now(),
  prefix = 'adula'
): BackupStatus {
  if (!/^adula(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)) throw new Error('Invalid backup prefix')
  const root = prefix + '/'
  const snapshots = new Map<string, Set<string>>()
  for (const object of objects) {
    if (!object.key.startsWith(root)) continue
    const match =
      /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)\/(database\.dump|uploads\.tar\.gz|SHA256SUMS|COMPLETE)$/.exec(
        object.key.slice(root.length)
      )
    const age = now - Date.parse(object.modifiedAt)
    if (
      !match ||
      !Number.isFinite(object.size) ||
      (match[2] === 'COMPLETE' ? object.size < 0 : object.size <= 0) ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 48 * 3600000
    )
      continue
    const files = snapshots.get(match[1]) ?? new Set<string>()
    files.add(match[2])
    snapshots.set(match[1], files)
  }
  const healthy = [...snapshots.values()].some((files) => files.size === 4)
  return {
    healthy,
    reason: healthy ? 'recent_complete_snapshot' : 'missing_recent_complete_snapshot',
    checkedAt: new Date(now).toISOString(),
  }
}

export async function verifyBackup(
  db: Knex,
  inspect: () => Promise<BackupObject[]>,
  now = Date.now(),
  prefix = 'adula'
) {
  let status: BackupStatus
  try {
    status = assessBackup(await inspect(), now, prefix)
  } catch {
    status = {
      healthy: false,
      reason: 'offsite_check_failed',
      checkedAt: new Date(now).toISOString(),
    }
  }
  await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(?)', [19300210])
    const settings = new Settings(trx)
    const previous = await settings.get<BackupStatus>('backup.health')
    await settings.set('backup.health', status)
    if (!status.healthy && (previous?.healthy !== false || previous.reason !== status.reason)) {
      const admins = await trx('user_roles as ur')
        .join('roles as r', 'r.id', 'ur.role_id')
        .where('r.permission_level', '>=', 1)
        .whereNull('ur.org_unit_id')
        .distinct('ur.user_id')
      for (const admin of admins)
        await notify(
          trx,
          admin.user_id,
          'تعذّر التحقق من النسخة الاحتياطية',
          'تحقق من مخزن النسخ الخارجي ووجود نسخة كاملة خلال آخر 48 ساعة.'
        )
    }
  })
  return status
}
