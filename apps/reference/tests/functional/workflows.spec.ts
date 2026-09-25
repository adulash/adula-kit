import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { consumeEvent, type DomainEvent } from '@adula/kit'
import User from '#models/user'
import { kit } from '#services/kit'
import { listeners } from '#start/listeners'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

/** Publishes pending outbox events to every registered listener, as the worker does. */
async function drainOutbox() {
  const rows = await knex()('outbox').whereNull('published_at').orderBy('created_at')
  for (const row of rows) {
    const event: DomainEvent = { id: row.id, event: row.event, payload: row.payload }
    for (const listener of listeners) await consumeEvent(knex(), listener, event)
    await knex()('outbox').where('id', row.id).update({ published_at: knex().fn.now() })
  }
}

async function roleMember(name: string, orgUnitId: number, fullName: string) {
  const user = await User.create({
    fullName,
    email: `${name.length}-${Date.now()}-${Math.random()}@example.test`,
    password: 'workflow-test-password-123',
  })
  let role = await knex()('roles').where('name', name).first()
  if (!role) {
    ;[role] = await knex()('roles').insert({ name, permission_level: 1 }).returning('*')
    await knex()('role_rules').insert({ role_id: role.id, subject: 'orders', action: 'view' })
  }
  await knex()('user_roles').insert({ user_id: user.id, role_id: role.id })
  await knex()('user_org_units').insert({ user_id: user.id, org_unit_id: orgUnitId })
  return user
}

test.group('Two-level order approval workflow over HTTP', (group) => {
  let clerk: UiActor
  let manager: User
  let director: User
  group.setup(async () => {
    clerk = await seedActor([{ subject: 'orders', action: 'manage' }], {
      fullName: 'مقدم الطلب',
      level: 1,
    })
    manager = await roleMember('مدير القسم', clerk.orgUnitId, 'مدير القسم')
    director = await roleMember('المدير العام', clerk.orgUnitId, 'المدير العام')
    await knex()('lookups')
      .insert({ group: 'order_status', key: 'approved', label_ar: 'معتمد', label_en: 'Approved' })
      .onConflict(['group', 'key'])
      .ignore()
  })

  async function submit(client: any, total: string) {
    const created = await client
      .post('/resources/orders')
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
      .json({ notes: 'طلب شراء أجهزة', total, orgUnitId: clerk.orgUnitId })
    created.assertStatus(201)
    const order = created.body().data
    const submitted = await client
      .post(`/resources/orders/${order.id}/submit`)
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
      .json({ version: order.version })
    submitted.assertStatus(200)
    await drainOutbox()
    return Number(order.id)
  }

  test('manager then director approve; the order is marked approved', async ({
    client,
    assert,
  }) => {
    const id = await submit(client, '2500000')
    const inbox = await client
      .get('/approvals')
      .loginAs(manager)
      .header('Accept', 'text/html')
      .withInertia()
    inbox.assertStatus(200)
    assert.equal(inbox.body().component, 'work/approvals')
    const [run] = inbox.body().props.runs
    assert.equal(run.recordId, id)
    assert.equal(run.myApproval.title, 'موافقة مدير القسم')
    // The director has nothing to decide yet.
    const early = await client
      .post(`/workflows/${run.id}/decide`)
      .loginAs(director)
      .withCsrfToken()
      .headers(json)
      .json({ decision: 'approve' })
    early.assertStatus(409)
    const first = await client
      .post(`/workflows/${run.id}/decide`)
      .loginAs(manager)
      .withCsrfToken()
      .headers(json)
      .json({ decision: 'approve', comment: 'موافق' })
    first.assertStatus(200)
    assert.equal(first.body().data.step, 'director')
    const second = await client
      .post(`/workflows/${run.id}/decide`)
      .loginAs(director)
      .withCsrfToken()
      .headers(json)
      .json({ decision: 'approve' })
    second.assertStatus(200)
    assert.equal(second.body().data.outcome, 'approved')
    const order = await knex()('orders').where('id', id).first()
    assert.equal(order.status, 'approved')
    const runs = await client
      .get(`/resources/orders/${id}/workflows`)
      .loginAs(clerk.user)
      .headers(json)
    assert.equal(runs.body().data[0].status, 'completed')
    const notice = await knex()('notifications')
      .where('user_id', clerk.user.id)
      .orderBy('id', 'desc')
      .first()
    assert.include(notice.title, 'اعتماد الطلبات')
  })

  test('rejection cancels the order, which can then be amended by copy', async ({
    client,
    assert,
  }) => {
    const id = await submit(client, '3000000')
    const [run] = await kit().workflows.inbox(await kit().actors.load(manager.id))
    const rejected = await client
      .post(`/workflows/${run.id}/decide`)
      .loginAs(manager)
      .withCsrfToken()
      .headers(json)
      .json({ decision: 'reject', comment: 'الميزانية لا تسمح' })
    rejected.assertStatus(200)
    assert.equal(rejected.body().data.outcome, 'rejected')
    const shown = await client.get(`/resources/orders/${id}`).loginAs(clerk.user).headers(json)
    assert.equal(shown.body().data.docStatus, 2)
    assert.isTrue(shown.body().permissions.amend)
    const amended = await client
      .post(`/resources/orders/${id}/amend`)
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
    amended.assertStatus(201)
    assert.equal(amended.body().data.docStatus, 0)
    assert.equal(amended.body().data.notes, 'طلب شراء أجهزة')
  })

  test('small orders are approved without approvers; failed runs list is admin only', async ({
    client,
    assert,
  }) => {
    const id = await submit(client, '1000')
    const [run] = await kit().workflows.runsFor(
      'orders',
      id,
      await kit().actors.load(clerk.user.id)
    )
    assert.equal(run.outcome, 'approved')
    const denied = await client.get('/admin/workflows').loginAs(manager).headers(json)
    denied.assertStatus(403)
  })
})
