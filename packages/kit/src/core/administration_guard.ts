import type { Knex } from 'knex'
import { buildAbility, type Rule } from '../auth/ability.js'
import { KitError } from '../admin/errors.js'

/** Same CASL decision as the admin middleware, with fresh rows inside the transaction. */
async function administrators(db: Knex): Promise<Set<number>> {
  const rows = await db('user_roles as ur')
    .join('users as u', 'u.id', 'ur.user_id')
    .join('role_rules as rr', 'rr.role_id', 'ur.role_id')
    .whereNull('u.disabled_at')
    .whereNull('ur.org_unit_id')
    .where('rr.subject', 'all')
    .select('ur.user_id', 'rr.subject', 'rr.action', 'rr.inverted', 'rr.conditions', 'rr.fields')
  const users = new Map<number, Rule[]>()
  for (const row of rows) {
    const rules = users.get(row.user_id) ?? []
    rules.push({
      subject: row.subject,
      action: row.action,
      inverted: row.inverted,
      conditions: row.conditions ?? undefined,
      fields: row.fields ?? undefined,
    })
    users.set(row.user_id, rules)
  }
  return new Set(
    [...users].filter(([, rules]) => buildAbility(rules).can('manage', 'all')).map(([id]) => id)
  )
}

/** Serialize access-changing mutations, including simultaneous requests by different admins. */
export async function administrationGuard(trx: Knex.Transaction, actorId: number) {
  await trx.raw('SELECT pg_advisory_xact_lock(717011)')
  const before = await administrators(trx)
  return async () => {
    const after = await administrators(trx)
    if (before.size && !after.size)
      throw new KitError(
        409,
        'E_LAST_ADMIN',
        'لا يمكن تنفيذ هذا التغيير لأنه سيزيل آخر مدير نشط للنظام. عيّن مديرًا آخر أولًا.'
      )
    if (before.has(actorId) && !after.has(actorId))
      throw new KitError(
        409,
        'E_SELF_ADMIN_ACCESS',
        'لا يمكنك إزالة صلاحية إدارة النظام من حسابك الحالي. اطلب من مدير آخر تعديلها.'
      )
  }
}
