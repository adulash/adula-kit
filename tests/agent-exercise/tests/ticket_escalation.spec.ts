import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { consumeEvent, type DomainEvent } from '@adula/kit'
import User from '#models/user'
import { kit } from '#services/kit'
import { listeners } from '#start/listeners'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'
import { ticketPriorities } from '#tests/helpers/resource_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

async function drain() {
  for (const row of await knex()('outbox').whereNull('published_at').orderBy('created_at')) {
    const event: DomainEvent = { id: row.id, event: row.event, payload: row.payload }
    for (const listener of listeners) await consumeEvent(knex(), listener, event)
    await knex()('outbox').where('id', row.id).update({ published_at: knex().fn.now() })
  }
}

test.group('Support ticket escalation', (group) => {
  let agent: UiActor
  let supervisor: User
  group.setup(async () => {
    await ticketPriorities()
    agent = await seedActor(
      [
        { subject: 'tickets', action: 'manage' },
        { subject: 'ticket_replies', action: 'manage' },
      ],
      {
        fullName: 'موظف الدعم',
        level: 0,
      }
    )
    supervisor = await User.create({
      fullName: 'مشرف الدعم',
      email: `supervisor-${Date.now()}@example.test`,
      password: 'supervisor-password-123',
    })
    const [role] = await knex()('roles')
      .insert({ name: 'مشرف الدعم', permission_level: 0 })
      .returning('*')
    await knex()('role_rules').insert({ role_id: role.id, subject: 'tickets', action: 'view' })
    await knex()('user_roles').insert({ user_id: supervisor.id, role_id: role.id })
    await knex()('user_org_units').insert({ user_id: supervisor.id, org_unit_id: agent.orgUnitId })
  })

  test('a high-priority ticket with a reply is escalated after the supervisor approves', async ({
    client,
    assert,
  }) => {
    const created = await client
      .post('/resources/tickets')
      .loginAs(agent.user)
      .withCsrfToken()
      .headers(json)
      .json({
        subject: 'انقطاع الشبكة',
        priority: 'high',
        orgUnitId: agent.orgUnitId,
        replies: [{ body: 'تم استلام البلاغ' }],
      })
    created.assertStatus(201)
    const ticket = created.body().data
    assert.match(ticket.number, /^TKT-\d{6}$/)
    const submitted = await client
      .post(`/resources/tickets/${ticket.id}/submit`)
      .loginAs(agent.user)
      .withCsrfToken()
      .headers(json)
      .json({ version: ticket.version })
    submitted.assertStatus(200)
    await drain()
    const [run] = await kit().workflows.inbox(await kit().actors.load(supervisor.id))
    assert.equal(run.recordId, ticket.id)
    const decided = await client
      .post(`/workflows/${run.id}/decide`)
      .loginAs(supervisor)
      .withCsrfToken()
      .headers(json)
      .json({ decision: 'approve' })
    decided.assertStatus(200)
    assert.equal(decided.body().data.status, 'completed')
    const row = await knex()('tickets').where('id', ticket.id).first()
    assert.isTrue(row.escalated)
    const replies = await knex()('ticket_replies').where('ticket_id', ticket.id)
    assert.lengthOf(replies, 1)
  })

  test('normal tickets complete without approval', async ({ client, assert }) => {
    const created = await client
      .post('/resources/tickets')
      .loginAs(agent.user)
      .withCsrfToken()
      .headers(json)
      .json({ subject: 'طلب حبر', priority: 'normal', orgUnitId: agent.orgUnitId })
    const ticket = created.body().data
    await client
      .post(`/resources/tickets/${ticket.id}/submit`)
      .loginAs(agent.user)
      .withCsrfToken()
      .headers(json)
      .json({ version: ticket.version })
    await drain()
    const [run] = await kit().workflows.runsFor(
      'tickets',
      ticket.id,
      await kit().actors.load(agent.user.id)
    )
    assert.equal(run.outcome, 'completed')
    const row = await knex()('tickets').where('id', ticket.id).first()
    assert.isNotTrue(row.escalated)
  })
})
