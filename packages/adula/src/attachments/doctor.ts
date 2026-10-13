import type { Knex } from 'knex'
import type { Finding } from '../commands/doctor.js'

const STALE_UPLOAD_MS = 24 * 3600000

/** Unbound uploads are files whose form was never saved; they are reported, never deleted here. */
export async function diagnoseAttachments(db: Knex, now = Date.now()): Promise<Finding> {
  try {
    const result = await db.raw(
      `SELECT
         count(*) FILTER (WHERE record_id IS NOT NULL) AS bound,
         count(*) FILTER (WHERE record_id IS NULL) AS unbound,
         count(*) FILTER (WHERE record_id IS NULL AND created_at < ?) AS stale,
         coalesce(sum(size), 0) AS bytes
       FROM attachments WHERE deleted_at IS NULL`,
      [new Date(now - STALE_UPLOAD_MS).toISOString()]
    )
    const row = result.rows[0]
    const live = Number(row.bound) + Number(row.unbound)
    return {
      check: 'attachments',
      status: 'info',
      message: `${row.bound} bound attachments, ${row.unbound} unbound uploads (${row.stale} older than 24 hours), ${row.bytes} bytes in ${live} live files`,
    }
  } catch (error) {
    if ((error as { code?: string }).code === '42P01')
      return {
        check: 'attachments',
        status: 'warn',
        message: 'attachments table is missing; run migration:run',
      }
    throw error
  }
}
