import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import type { ResourceRegistry } from '../resource/registry.js'
import { identifier } from '../resource/define_resource.js'
import { KitError } from '../admin/errors.js'
import { moveOrgUnit } from '../org/org_service.js'
import { logActivity } from './activity.js'

export type OrgUnitNode = {
  id: number
  parentId: number | null
  name: string
  type: string
  path: string
  depth: number
  members: number
}

const RESOURCE = 'core.org_units'
// Shared with moveOrgUnit so every tree edit serializes on the same lock.
const TREE_LOCK = 717010

function text(value: unknown, field: string) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.length > 100)
    throw new KitError(422, 'E_ORG_INPUT', `${field} مطلوب (حتى 100 حرف)`)
  return trimmed
}

export class OrgUnitsAdmin {
  constructor(
    private db: Knex,
    private registry: ResourceRegistry
  ) {}

  async tree(): Promise<OrgUnitNode[]> {
    const rows = await this.db('org_units as o')
      .select(
        'o.id',
        'o.parent_id',
        'o.name',
        'o.type',
        this.db.raw('o.path::text AS path'),
        this.db.raw('nlevel(o.path) AS depth'),
        this.db.raw('(SELECT count(*) FROM user_org_units m WHERE m.org_unit_id = o.id) AS members')
      )
      .orderBy('o.path')
    return rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id ?? null,
      name: row.name,
      type: row.type,
      path: row.path,
      depth: Number(row.depth),
      members: Number(row.members),
    }))
  }

  async create(actorId: number, input: { parentId: number | null; name: string; type: string }) {
    const name = text(input.name, 'الاسم')
    const type = text(input.type, 'النوع')
    return this.db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [TREE_LOCK])
      const parent =
        input.parentId === null ? null : await trx('org_units').where('id', input.parentId).first()
      if (input.parentId !== null && !parent)
        throw new KitError(404, 'E_ORG_NOT_FOUND', 'الوحدة الأم غير موجودة')
      const [unit] = await trx('org_units')
        .insert({
          parent_id: input.parentId,
          name,
          type,
          path: `tmp_${randomBytes(8).toString('hex')}`,
        })
        .returning('id')
      const path = parent ? `${parent.path}.${unit.id}` : `${unit.id}`
      await trx('org_units').where('id', unit.id).update({ path })
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: unit.id,
        actorId,
        action: 'create',
        changes: { name, type, parentId: input.parentId, path },
      })
      return { id: unit.id as number, path }
    })
  }

  async rename(actorId: number, id: number, value: string) {
    const name = text(value, 'الاسم')
    return this.db.transaction(async (trx) => {
      const unit = await this.find(trx, id)
      await trx('org_units').where('id', id).update({ name })
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: id,
        actorId,
        action: 'rename',
        changes: { from: unit.name, to: name },
      })
    })
  }

  async move(actorId: number, id: number, parentId: number | null) {
    return this.db.transaction(async (trx) => {
      const unit = await this.find(trx, id)
      await moveOrgUnit(trx, id, parentId)
      const moved = await trx('org_units').where('id', id).first()
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: id,
        actorId,
        action: 'move',
        changes: { from: unit.parent_id ?? null, to: parentId, path: String(moved.path) },
      })
    })
  }

  /** A unit leaves only when nothing points at it: children, memberships or scoped records. */
  async delete(actorId: number, id: number) {
    return this.db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [TREE_LOCK])
      const unit = await this.find(trx, id)
      if (await trx('org_units').where('parent_id', id).first())
        throw new KitError(409, 'E_ORG_HAS_CHILDREN', 'انقل الوحدات الفرعية أولاً')
      if (
        (await trx('user_org_units').where('org_unit_id', id).first()) ||
        (await trx('user_roles').where('org_unit_id', id).first())
      )
        throw new KitError(409, 'E_ORG_HAS_MEMBERS', 'أزل أعضاء الوحدة وأدوارها المقيدة أولاً')
      for (const resource of this.registry.all().filter((r) => r.scoped)) {
        const record = await trx(identifier(resource.name)).where('org_unit_id', id).first('id')
        if (record)
          throw new KitError(
            409,
            'E_ORG_HAS_RECORDS',
            `الوحدة تحتوي سجلات في ${resource.label.ar}؛ انقلها أولاً`
          )
      }
      await trx('org_units').where('id', id).delete()
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: id,
        actorId,
        action: 'delete',
        changes: { name: unit.name, path: String(unit.path) },
      })
    })
  }

  private async find(db: Knex, id: number) {
    const unit = await db('org_units').where('id', id).first()
    if (!unit) throw new KitError(404, 'E_ORG_NOT_FOUND', 'الوحدة التنظيمية غير موجودة')
    return unit
  }
}
