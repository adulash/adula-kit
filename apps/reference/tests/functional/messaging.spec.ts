import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import transmit from '@adonisjs/transmit/services/main'
import { notifyWithTemplate } from '@adula/kit'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

test.group('Message templates and realtime notifications', (group) => {
  let admin: UiActor
  let member: UiActor
  group.setup(async () => {
    admin = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'مدير الرسائل' })
    member = await seedActor([{ subject: 'customers', action: 'view' }], {
      fullName: 'عضو',
      level: 0,
    })
  })
  group.each.setup(async () => {
    await knex()('message_templates').del()
  })

  test('administrators edit a template and notifications use the new wording', async ({
    client,
    assert,
  }) => {
    const list = await client.get('/admin/templates').loginAs(admin.user).headers(json)
    list.assertStatus(200)
    assert.exists(
      list.body().data.find((entry: { key: string }) => entry.key === 'assignment.created')
    )
    const saved = await client
      .put('/admin/templates/assignment.created')
      .loginAs(admin.user)
      .withCsrfToken()
      .headers(json)
      .json({ subject: 'مهمة: {{title}}', body: 'على {{resource}}', mail: false })
    saved.assertStatus(200)
    const invalid = await client
      .put('/admin/templates/assignment.created')
      .loginAs(admin.user)
      .withCsrfToken()
      .headers(json)
      .json({ subject: '{{secret}}', body: 'x' })
    invalid.assertStatus(422)
    await notifyWithTemplate(knex(), member.user.id, 'assignment.created', {
      title: 'جرد',
      resource: 'المخزون',
    })
    const row = await knex()('notifications').where('user_id', member.user.id).first()
    assert.equal(row.title, 'مهمة: جرد')
    assert.isNull(row.mail_state)

    const reset = await client
      .delete('/admin/templates/assignment.created')
      .loginAs(admin.user)
      .withCsrfToken()
      .headers(json)
    reset.assertStatus(200)
  })

  test('non-administrators cannot read or edit templates', async ({ client }) => {
    const read = await client.get('/admin/templates').loginAs(member.user).headers(json)
    read.assertStatus(403)
    const edit = await client
      .put('/admin/templates/assignment.created')
      .loginAs(member.user)
      .withCsrfToken()
      .headers(json)
      .json({ subject: 'x', body: 'y' })
    edit.assertStatus(403)
  })

  test('a committed notification is broadcast on the recipient channel only', async ({
    assert,
  }) => {
    const broadcasts: { channel: string; payload: unknown }[] = []
    const stop = transmit.on('broadcast', (event) => {
      broadcasts.push(event as { channel: string; payload: unknown })
    })
    try {
      await notifyWithTemplate(knex(), member.user.id, 'comment.created', { author: 'x' })
      const deadline = Date.now() + 5000
      while (!broadcasts.length && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 50))
      assert.lengthOf(broadcasts, 1)
      assert.equal(broadcasts[0].channel, `notifications/${member.user.id}`)
    } finally {
      stop()
    }
  })

  test('only signed-in clients reach the subscription endpoint', async ({ client, assert }) => {
    const anonymous = await client
      .post('/__transmit/subscribe')
      .withCsrfToken()
      .headers(json)
      .json({ uid: 'unknown-stream-id', channel: `notifications/${member.user.id}` })
    anonymous.assertStatus(401)
    const foreign = await client
      .post('/__transmit/subscribe')
      .loginAs(admin.user)
      .withCsrfToken()
      .headers(json)
      .json({ uid: 'unknown-stream-id', channel: `notifications/${member.user.id}` })
    // No open stream for this uid and a foreign channel: never a successful subscription.
    assert.oneOf(foreign.status(), [400, 401, 403])
  })
})
