import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { UNBOUND_UPLOAD_TTL_MS, forgetUpload, staleUploads } from '@adula/kit'

/**
 * Removes uploads that were never bound to a record: the file first, then the
 * row, so a failed delete leaves the row for the next run. Bound attachments,
 * including released ones kept for restore drills, are never touched.
 */
export async function pruneUnboundUploads(now = new Date()) {
  const knex = db.connection().getWriteClient()
  const cutoff = new Date(now.getTime() - UNBOUND_UPLOAD_TTL_MS)
  let removed = 0
  let failed = 0
  for (const upload of await staleUploads(knex, cutoff)) {
    try {
      await drive.use(upload.disk as never).delete(upload.path)
      if (await forgetUpload(knex, upload.id)) removed++
    } catch {
      failed++
    }
  }
  return { removed, failed }
}
