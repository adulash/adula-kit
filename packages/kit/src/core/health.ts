import type { Knex } from 'knex'
import { Settings } from '../services/settings.js'

export type HeartbeatStatus = { at: string | null; ageMs: number | null; healthy: boolean }
export type FailedJob = {
  id: string
  name: string
  attemptsMade: number
  failedReason: string
  failedAt: string | null
}
export type QueueCounts = Record<'waiting' | 'active' | 'delayed' | 'failed' | 'completed', number>
/** Filled by the host from its queue backend; the kit never talks to BullMQ. */
export type QueueSnapshot = { name: string; counts: QueueCounts; failed: FailedJob[] }
export type RuntimeHealth = {
  outbox: { backlog: number; oldestAgeMs: number | null }
  processedEvents: number
  heartbeats: { scheduler: HeartbeatStatus; worker: HeartbeatStatus }
  backup: { lastOffsite: string | null; lastRestoreTest: string | null; stale: boolean }
}

export const HEARTBEAT_MAX_AGE_MS = 60_000
export const BACKUP_MAX_AGE_MS = 48 * 3_600_000

function age(value: unknown, now: number) {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isFinite(at) ? now - at : null
}

export function heartbeat(value: unknown, now = Date.now()): HeartbeatStatus {
  const ageMs = age(value, now)
  return {
    at: ageMs === null ? null : String(value),
    ageMs,
    healthy: ageMs !== null && ageMs >= 0 && ageMs < HEARTBEAT_MAX_AGE_MS,
  }
}

export function backupStale(lastOffsite: unknown, now = Date.now()) {
  const ageMs = age(lastOffsite, now)
  return ageMs === null || ageMs < 0 || ageMs >= BACKUP_MAX_AGE_MS
}

export async function isBackupStale(db: Knex, now = Date.now()) {
  return backupStale(await new Settings(db).get<string>('backup.lastOffsite'), now)
}

export async function runtimeHealth(db: Knex, now = Date.now()): Promise<RuntimeHealth> {
  const settings = new Settings(db)
  const outbox = await db('outbox')
    .whereNull('published_at')
    .select(db.raw('count(*) AS backlog'), db.raw('min(created_at) AS oldest'))
    .first()
  const processed = await db('processed_events').count('event_id as count').first()
  const lastOffsite = (await settings.get<string>('backup.lastOffsite')) ?? null
  const lastRestoreTest = (await settings.get<string>('backup.lastRestoreTest')) ?? null
  return {
    outbox: {
      backlog: Number(outbox?.backlog ?? 0),
      oldestAgeMs: outbox?.oldest ? Math.max(0, now - new Date(outbox.oldest).getTime()) : null,
    },
    processedEvents: Number(processed?.count ?? 0),
    heartbeats: {
      scheduler: heartbeat(await settings.get('scheduler.heartbeat'), now),
      worker: heartbeat(await settings.get('worker.heartbeat'), now),
    },
    backup: { lastOffsite, lastRestoreTest, stale: backupStale(lastOffsite, now) },
  }
}
