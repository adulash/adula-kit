import { test } from '@japa/runner'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import { consumeEvent, type DomainEvent } from '@adula/kit'
import User from '#models/user'
import { kit } from '#services/kit'
import { listeners } from '#start/listeners'
import { screenshotDir, seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const knex = () => db.connection().getWriteClient()

test.group('Workflow approvals browser acceptance', (group) => {
  let clerk: UiActor
  let manager: User
  let id: number
  group.setup(async () => {
    clerk = await seedActor([{ subject: 'orders', action: 'manage' }], { fullName: 'مقدمة الطلب' })
    const member = async (roleName: string, fullName: string) => {
      const user = await User.create({
        fullName,
        email: `browser-${roleName.length}-${Date.now()}@example.test`,
        password: 'browser-workflow-password-123',
      })
      let role = await knex()('roles').where('name', roleName).first()
      if (!role) {
        ;[role] = await knex()('roles')
          .insert({ name: roleName, permission_level: 1 })
          .returning('*')
        await knex()('role_rules').insert({ role_id: role.id, subject: 'orders', action: 'view' })
      }
      await knex()('user_roles').insert({ user_id: user.id, role_id: role.id })
      await knex()('user_org_units').insert({ user_id: user.id, org_unit_id: clerk.orgUnitId })
      return user
    }
    manager = await member('مدير القسم', 'مدير القسم للمتصفح')
    await member('المدير العام', 'المدير العام للمتصفح')
    const actor = await kit().actors.load(clerk.user.id)
    const order = await kit().resources.save('orders', actor, {
      notes: 'طلب يحتاج موافقة',
      total: '5000000',
      orgUnitId: clerk.orgUnitId,
    })
    id = Number(order.id)
    await kit().resources.transition('orders', id, actor, 'submit', order.version)
    const rows = await knex()('outbox').whereNull('published_at')
    for (const row of rows) {
      const event: DomainEvent = { id: row.id, event: row.event, payload: row.payload }
      for (const listener of listeners) await consumeEvent(knex(), listener, event)
      await knex()('outbox').where('id', row.id).update({ published_at: knex().fn.now() })
    }
  })

  test('the manager approves from the inbox and the record shows the history', async ({
    browserContext,
    visit,
  }) => {
    await browserContext.loginAs(manager)
    const inbox = await visit('/approvals')
    await inbox.getByRole('heading', { name: 'صندوق الموافقات' }).waitFor()
    await inbox.getByText('موافقة مدير القسم').waitFor()
    await inbox.screenshot({ path: join(await screenshotDir(), 'approvals-inbox.png') })
    await inbox.getByRole('button', { name: 'موافقة', exact: true }).click()
    const dialog = inbox.getByRole('dialog', { name: 'تأكيد الموافقة' })
    await dialog.getByLabel('ملاحظة (اختيارية)').fill('مطابق للميزانية')
    await dialog.getByRole('button', { name: 'موافقة', exact: true }).click()
    await inbox.getByText('لا موافقات معلقة.').waitFor()

    const record = await visit(`/resources/orders/${id}`)
    const panel = record.getByRole('region', { name: 'سير العمل' })
    await panel.getByText('بانتظار موافقة').waitFor()
    await panel.getByText('«مطابق للميزانية»').waitFor()
    await record.screenshot({ path: join(await screenshotDir(), 'record-workflow.png') })
  })
})
