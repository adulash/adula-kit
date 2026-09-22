import type { Knex } from 'knex'
import { KitError } from '../admin/errors.js'

export async function moveOrgUnit(db: Knex, id: number, parentId: number | null) {
  await db.transaction(async (trx) => {
    // Serialize tree edits; concurrent sibling/ancestor moves cannot corrupt paths.
    await trx.raw('SELECT pg_advisory_xact_lock(717010)')
    const unit = await trx('org_units').where({ id }).forUpdate().first()
    const parent =
      parentId === null ? null : await trx('org_units').where({ id: parentId }).forUpdate().first()
    if (!unit || (parentId !== null && !parent))
      throw new KitError(404, 'E_ORG_NOT_FOUND', 'Organization unit not found')
    if (parent && (parent.path === unit.path || parent.path.startsWith(`${unit.path}.`)))
      throw new KitError(422, 'E_ORG_CYCLE', 'A unit cannot move beneath itself')
    const next = parent ? `${parent.path}.${id}` : `${id}`
    await trx.raw(
      'UPDATE org_units SET path = ?::ltree || subpath(path,nlevel(?::ltree)) WHERE path <@ ?::ltree AND id <> ?',
      [next, unit.path, unit.path, id]
    )
    await trx('org_units').where({ id }).update({ parent_id: parentId, path: next })
  })
}
