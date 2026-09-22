import type { Knex } from 'knex'
import type { Actor, Rule } from './ability.js'
import type { ResourceRegistry } from '../resource/registry.js'

export interface ActorCache {
  get(key: string): Promise<Actor | undefined>
  set(key: string, value: Actor): Promise<void>
}

export class ActorStore {
  constructor(
    private db: Knex,
    private registry: ResourceRegistry,
    private cache?: ActorCache
  ) {}
  async load(id: number): Promise<Actor> {
    // Revision is read on every request; DB triggers invalidate across workers and tree moves.
    const { version } = await this.db('authorization_revision').where({ id: 1 }).first('version')
    const key = `ability:${id}:${version}`
    const cached = await this.cache?.get(key)
    if (cached) return cached
    const memberships = await this.db('user_org_units as u')
      .join('org_units as o', 'o.id', 'u.org_unit_id')
      .where('u.user_id', id)
      .select('o.path')
    const assignments = await this.db('user_roles as ur')
      .join('roles as r', 'r.id', 'ur.role_id')
      .leftJoin('org_units as o', 'o.id', 'ur.org_unit_id')
      .join('role_rules as rr', 'rr.role_id', 'r.id')
      .where('ur.user_id', id)
      .select('rr.*', 'r.permission_level', 'o.path as role_path')
    const rules: Rule[] = []
    let permissionLevel = 0
    for (const row of assignments) {
      // Privileged field access only comes from deployment-wide roles.
      if (!row.role_path) permissionLevel = Math.max(permissionLevel, row.permission_level)
      const rule: Rule = {
        subject: row.subject,
        action: row.action,
        conditions: row.conditions ?? undefined,
        fields: row.fields ?? undefined,
        inverted: row.inverted,
      }
      if (!row.role_path) {
        rules.push(rule)
        continue
      }
      for (const resource of this.registry
        .all()
        .filter((r) => r.scoped && (rule.subject === 'all' || rule.subject === r.name))) {
        if (rule.conditions?.orgPath) throw new Error('orgPath is reserved for role scope')
        rules.push({
          ...rule,
          subject: resource.name,
          conditions: { ...rule.conditions, orgPath: row.role_path },
        })
        rules.push({
          ...rule,
          subject: resource.name,
          conditions: { ...rule.conditions, orgPath: { $like: `${row.role_path}.%` } },
        })
      }
    }
    const actor: Actor = { id, orgPaths: memberships.map((r) => r.path), permissionLevel, rules }
    await this.cache?.set(key, actor)
    return actor
  }
}
