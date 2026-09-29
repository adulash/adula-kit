import type { Knex } from 'knex'
import { createHash, randomBytes } from 'node:crypto'
import { KitError } from '../admin/errors.js'
import { logActivity } from '../core/activity.js'
import type { ResourceRegistry } from '../resource/registry.js'
import { isAttachmentId } from './attachment_service.js'

/** Longest lifetime of an upload grant; module pages ask for one right before the upload. */
export const UPLOAD_GRANT_MAX_TTL_MS = 60 * 60 * 1000
const DEFAULT_TTL_MS = 10 * 60 * 1000

export type UploadGrantInput = {
  resource: string
  recordId: number
  /** An attachment field of the resource. */
  field: string
  /** The user who may upload with the grant. */
  userId: number
  /** Who decided the grant (the module's signed-in user or a system actor); defaults to userId. */
  actorId?: number
  /** Lifetime in milliseconds, at most one hour (default ten minutes). */
  ttlMs?: number
}
export type UploadGrant = { token: string; expiresAt: string }
export type RedeemedUploadGrant = {
  id: number
  resource: string
  recordId: number
  field: string
  orgUnitId: number | null
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Lets one user upload a file for one attachment field of one existing record, when module
 * code has authorized that user itself (for example the inspector of a visit) and the role
 * rules grant no generic right. Only the token hash is stored. The grant bypasses the role
 * rule of the upload only: type, size, the pending-upload limit, ownership and binding
 * through the record write stay as for any upload, and the upload can bind to this record
 * only. Issuing it is recorded in the record's activity log. Call it from module code after
 * the module's own authorization, never on a user's word alone.
 */
export async function grantUpload(
  db: Knex,
  registry: Pick<ResourceRegistry, 'all' | 'get'>,
  input: UploadGrantInput
): Promise<UploadGrant> {
  if (
    typeof input.resource !== 'string' ||
    !registry.all().some((entry) => entry.name === input.resource)
  )
    throw new KitError(404, 'E_NOT_FOUND', 'الكيان غير موجود')
  const resource = registry.get(input.resource)
  const field = Object.hasOwn(resource.fields, input.field) ? resource.fields[input.field] : null
  if (!field || field.type !== 'attachment')
    throw new KitError(422, 'E_FIELD_INVALID', 'الحقل ليس حقل مرفقات')
  if (!isAttachmentId(input.recordId) || !isAttachmentId(input.userId))
    throw new KitError(422, 'E_UPLOAD_GRANT', 'Invalid record or user')
  if (input.actorId !== undefined && !isAttachmentId(input.actorId))
    throw new KitError(422, 'E_UPLOAD_GRANT', 'Invalid actor')
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS
  if (!Number.isSafeInteger(ttl) || ttl < 1000 || ttl > UPLOAD_GRANT_MAX_TTL_MS)
    throw new KitError(422, 'E_UPLOAD_GRANT', 'Grant lifetime must be between 1 second and 1 hour')
  const record = await db(resource.name)
    .where('id', input.recordId)
    .whereNull('deleted_at')
    .first([
      'id',
      ...(resource.scoped ? ['org_unit_id'] : []),
      ...(resource.submittable ? ['doc_status'] : []),
    ])
  if (!record) throw new KitError(404, 'E_NOT_FOUND', 'السجل غير موجود')
  // A submitted or cancelled document is locked: no new evidence can be bound to it.
  if (resource.submittable && Number(record.doc_status) !== 0)
    throw new KitError(409, 'E_DOCUMENT_LOCKED', 'المستند معتمد أو ملغى ولا يقبل مرفقات جديدة')
  // A disabled user cannot sign in, so cannot redeem the grant either.
  if (!(await db('users').where('id', input.userId).first('id')))
    throw new KitError(422, 'E_UPLOAD_GRANT', 'Unknown user')
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ttl)
  await db('upload_grants').insert({
    token_hash: hash(token),
    user_id: input.userId,
    resource: resource.name,
    record_id: input.recordId,
    field: input.field,
    org_unit_id: resource.scoped ? record.org_unit_id : null,
    expires_at: expiresAt,
    created_by: input.actorId ?? input.userId,
  })
  await logActivity(db, {
    resource: resource.name,
    recordId: input.recordId,
    actorId: input.actorId ?? input.userId,
    action: 'upload_granted',
    changes: { field: input.field, userId: input.userId, expiresAt: expiresAt.toISOString() },
  })
  return { token, expiresAt: expiresAt.toISOString() }
}

/** The grant a token names, while it is unexpired and held by this user; otherwise null. */
export async function redeemUploadGrant(
  db: Knex,
  token: unknown,
  userId: number
): Promise<RedeemedUploadGrant | null> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const row = await db('upload_grants')
    .where({ token_hash: hash(token), user_id: userId })
    .where('expires_at', '>', db.fn.now())
    .first()
  if (!row) return null
  return {
    id: Number(row.id),
    resource: String(row.resource),
    recordId: Number(row.record_id),
    field: String(row.field),
    orgUnitId: row.org_unit_id === null ? null : Number(row.org_unit_id),
  }
}

/** Removes expired grants; the upload pruning schedule may call it. */
export async function pruneUploadGrants(db: Knex) {
  return db('upload_grants').where('expires_at', '<=', db.fn.now()).delete()
}
