import { randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { kit } from '#services/kit'
import type { BaseCommand } from '@adonisjs/core/ace'

export async function seedData(userId: number, count: number, logger: BaseCommand['logger']) {
  const knex = db.connection().getWriteClient()
  const root = await knex('org_units').whereNull('parent_id').first()
  const units = [root]
  for (const name of ['الإدارة العامة', 'إدارة العمليات', 'مكتب الخدمات']) {
    let unit = await knex('org_units').where({ name, parent_id: root.id }).first()
    if (!unit) {
      const [created] = await knex('org_units')
        .insert({
          name,
          parent_id: root.id,
          type: 'department',
          path: `pending_${randomBytes(6).toString('hex')}`,
        })
        .returning('*')
      await knex('org_units')
        .where('id', created.id)
        .update({ path: `${root.id}.${created.id}` })
      unit = created
    }
    units.push(unit)
  }
  for (const [key, ar, en] of [
    ['open', 'مفتوح', 'Open'],
    ['closed', 'مغلق', 'Closed'],
  ]) {
    await knex('lookups')
      .insert({ group: 'order_status', key, label_ar: ar, label_en: en })
      .onConflict(['group', 'key'])
      .ignore()
  }
  const runtime = kit()
  const actor = await runtime.actors.load(userId)
  let customer = await knex('customers')
    .where('name', 'شركة الأفق للخدمات المتكاملة')
    .whereNull('deleted_at')
    .first()
  if (!customer)
    customer = await runtime.resources.save('customers', actor, {
      name: 'شركة الأفق للخدمات المتكاملة',
      email: 'contact@example.test',
    })
  for (let index = 0; index < count; index++) {
    const unit = index % 10 < 7 ? units[1] : units[2 + (index % 2)]
    const order = await runtime.resources.save('orders', actor, {
      orgUnitId: unit.id,
      customerId: customer.id,
      status: 'open',
      total: String((index + 1) * 12500),
      notes: `طلب تجريبي رقم ${index + 1} — تجهيز ومتابعة الأعمال`,
      issuedAt: '2026-09-17',
    })
    if (index % 10 === 9)
      await runtime.resources.transition('orders', Number(order.id), actor, 'delete', order.version)
    else if (index % 4 === 0)
      await runtime.resources.save('tasks', actor, {
        orgUnitId: unit.id,
        orderId: order.id,
        title: `متابعة ${order.number}`,
        done: false,
      })
  }
  logger.success(
    `Seeded ${count} orders with uneven organization distribution, tasks and soft deletions`
  )
}
