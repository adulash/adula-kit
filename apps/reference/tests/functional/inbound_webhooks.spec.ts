import { createHmac } from 'node:crypto'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()
const sign = (secret: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

test.group('Signed inbound webhooks over HTTP', (group) => {
  let admin: UiActor
  let member: UiActor
  group.setup(async () => {
    admin = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'مدير الربط' })
    member = await seedActor([{ subject: 'customers', action: 'view' }], { level: 0 })
  })

  test('a sender posts a signed delivery once; administrators see and redispatch it', async ({
    client,
    assert,
  }) => {
    const key = `git${Date.now()}`
    const created = await client
      .post('/admin/inbound-webhooks')
      .loginAs(admin.user)
      .withCsrfToken()
      .headers(json)
      .json({ key, name: 'مستودعات الشيفرة' })
    created.assertStatus(201)
    const { source, secret } = created.body().data
    assert.equal(source.path, `/webhooks/in/${key}`)
    const payload = { action: 'opened', pull_request: { title: 'TSK-000123' } }
    const body = JSON.stringify(payload)
    // No session and no CSRF token: the signature is the authentication.
    const post = (signature: string, delivery: string) =>
      client
        .post(`/webhooks/in/${key}`)
        .header('X-Hub-Signature-256', signature)
        .header('X-GitHub-Event', 'pull_request')
        .header('X-GitHub-Delivery', delivery)
        .headers(json)
        .json(payload)
    const accepted = await post(sign(secret, body), 'd-1')
    accepted.assertStatus(202)
    assert.deepEqual(accepted.body().data, {
      delivery: 'd-1',
      event: `inbound.${key}.pull_request`,
      duplicate: false,
    })
    const repeated = await post(sign(secret, body), 'd-1')
    repeated.assertStatus(202)
    assert.isTrue(repeated.body().data.duplicate)
    const forged = await post(sign('guess', body), 'd-2')
    forged.assertStatus(401)
    const events = await knex()('outbox').where('event', `inbound.${key}.pull_request`)
    assert.lengthOf(events, 1)
    assert.deepEqual(events[0].payload.body, payload)

    const log = await client
      .get(`/admin/inbound-webhooks/${source.id}/deliveries`)
      .loginAs(admin.user)
      .headers(json)
    log.assertStatus(200)
    assert.lengthOf(log.body().data, 1)
    const redispatched = await client
      .post(`/admin/inbound-webhooks/deliveries/${log.body().data[0].id}/redispatch`)
      .loginAs(admin.user)
      .withCsrfToken()
      .headers(json)
    redispatched.assertStatus(200)
    assert.lengthOf(await knex()('outbox').where('event', `inbound.${key}.pull_request`), 2)
    const page = await client
      .get('/admin/webhooks')
      .loginAs(admin.user)
      .header('Accept', 'text/html')
      .withInertia()
    assert.exists(page.body().props.inbound.find((entry: { key: string }) => entry.key === key))
  })

  test('only administrators manage sources', async ({ client }) => {
    const denied = await client
      .post('/admin/inbound-webhooks')
      .loginAs(member.user)
      .withCsrfToken()
      .headers(json)
      .json({ key: 'intruder', name: 'x' })
    denied.assertStatus(403)
    const unknown = await client
      .post('/webhooks/in/missing_source')
      .header('X-Hub-Signature-256', 'sha256=00')
      .headers(json)
      .json({})
    unknown.assertStatus(404)
  })
})
