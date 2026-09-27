import { createHmac } from 'node:crypto'
import { test } from '@japa/runner'
import { InboundWebhooks, KitError, consumeEvent, inboundEventName } from '../index.js'
import type { DomainEvent, SecretBox } from '../index.js'
import { db, setup } from './helpers.js'

const secrets: SecretBox = {
  seal: (value) => `sealed:${Buffer.from(value).toString('base64')}`,
  open: (value) =>
    value.startsWith('sealed:') ? Buffer.from(value.slice(7), 'base64').toString() : null,
}
const sign = (secret: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

async function status(run: () => Promise<unknown>) {
  const error = await failure(run)
  return error.status
}
async function code(run: () => Promise<unknown>) {
  const error = await failure(run)
  return error.code
}
async function failure(run: () => Promise<unknown>): Promise<KitError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof KitError) return error
    throw error
  }
  throw new Error('Expected a KitError')
}

test.group('Signed inbound webhooks', (group) => {
  const inbound = new InboundWebhooks(db, secrets)
  let sourceId = 0
  let secret = ''
  group.setup(async () => {
    await setup()
    const created = await inbound.create(1, { key: 'github', name: 'مستودعات الشيفرة' })
    sourceId = created.source.id
    secret = created.secret
    ensure(created.source.path === '/webhooks/in/github')
    // The secret is stored sealed, never in clear text.
    const row = await db('inbound_sources').where('id', sourceId).first('secret')
    ensure(!String(row.secret).includes(secret))
  })
  function ensure(condition: boolean) {
    if (!condition) throw new Error('setup assertion failed')
  }
  const body = JSON.stringify({ action: 'opened', pull_request: { title: 'TSK-000123 إصلاح' } })
  const headers = (signature: string, delivery = 'delivery-1') => ({
    'x-hub-signature-256': signature,
    'x-github-event': 'pull_request',
    'x-github-delivery': delivery,
  })

  test('a verified delivery is stored once and raised as a domain event', async ({ assert }) => {
    const receipt = await inbound.receive('github', { headers: headers(sign(secret, body)), body })
    assert.deepEqual(receipt, {
      delivery: 'delivery-1',
      event: 'inbound.github.pull_request',
      duplicate: false,
    })
    const again = await inbound.receive('github', { headers: headers(sign(secret, body)), body })
    assert.isTrue(again.duplicate)
    const events = await db('outbox').where('event', 'inbound.github.pull_request')
    assert.lengthOf(events, 1)
    assert.deepEqual(events[0].payload, {
      source: 'github',
      delivery: 'delivery-1',
      event: 'pull_request',
      body: JSON.parse(body),
    })
    // Module listeners consume it through the outbox like any domain event.
    let seen: unknown
    const handled = await consumeEvent(
      db,
      {
        name: 'projects.link_pull_requests',
        event: 'inbound.github.pull_request',
        handle: async (event: DomainEvent) => {
          seen = event.payload.body
        },
      },
      { id: events[0].id, event: events[0].event, payload: events[0].payload }
    )
    assert.isTrue(handled)
    assert.deepEqual(seen, JSON.parse(body))
    const [delivery] = await inbound.deliveries(sourceId)
    assert.equal(delivery.deliveryId, 'delivery-1')
    assert.equal(delivery.eventName, 'inbound.github.pull_request')
    await inbound.redispatch(delivery.id)
    assert.lengthOf(await db('outbox').where('event', 'inbound.github.pull_request'), 2)
    const [redispatched] = await inbound.deliveries(sourceId)
    assert.equal(redispatched.dispatches, 2)
  })

  test('unsigned, forged, unknown and malformed deliveries are refused without a trace', async ({
    assert,
  }) => {
    const before = await db('inbound_deliveries').count('* as count').first()
    const forged = await failure(() =>
      inbound.receive('github', { headers: headers(sign('guessed', body), 'x2'), body })
    )
    assert.equal(forged.status, 401)
    const unsigned = await failure(() =>
      inbound.receive('github', { headers: { 'x-github-delivery': 'x3' }, body })
    )
    assert.equal(unsigned.status, 401)
    const tampered = await failure(() =>
      inbound.receive('github', {
        headers: headers(sign(secret, body), 'x4'),
        body: body.replace('opened', 'closed'),
      })
    )
    assert.equal(tampered.code, 'E_INBOUND_SIGNATURE')
    assert.equal(await status(() => inbound.receive('gitlab', { headers: {}, body })), 404)
    assert.equal(await status(() => inbound.receive('../etc', { headers: {}, body })), 404)
    const text = 'not json'
    const malformed = await failure(() =>
      inbound.receive('github', { headers: headers(sign(secret, text), 'x5'), body: text })
    )
    assert.equal(malformed.status, 400)
    const huge = 'x'.repeat(1024 * 1024 + 1)
    assert.equal(await status(() => inbound.receive('github', { headers: {}, body: huge })), 413)
    const after = await db('inbound_deliveries').count('* as count').first()
    assert.equal(Number(after?.count), Number(before?.count))
    // Inactive sources and rotated secrets stop accepting at once.
    const rotated = await inbound.rotate(sourceId)
    const old = await failure(() =>
      inbound.receive('github', { headers: headers(sign(secret, body), 'x6'), body })
    )
    assert.equal(old.status, 401)
    const fresh = await inbound.receive('github', {
      headers: headers(sign(rotated, body), 'x7'),
      body,
    })
    assert.isFalse(fresh.duplicate)
    await inbound.update(sourceId, { name: 'مستودعات الشيفرة', active: false })
    const inactive = await failure(() =>
      inbound.receive('github', { headers: headers(sign(rotated, body), 'x8'), body })
    )
    assert.equal(inactive.status, 404)
  })

  test('sources validate keys and headers; senders without delivery ids dedupe by body', async ({
    assert,
  }) => {
    assert.equal(
      await code(() => inbound.create(1, { key: 'Git Hub', name: 'x' })),
      'E_INBOUND_KEY'
    )
    assert.equal(
      await code(() => inbound.create(1, { key: 'github', name: 'نسخة' })),
      'E_INBOUND_KEY'
    )
    assert.equal(
      await code(() => inbound.create(1, { key: 'ci', name: 'CI', signatureHeader: 'bad header' })),
      'E_INBOUND_HEADER'
    )
    const { source, secret: ciSecret } = await inbound.create(1, {
      key: 'ci',
      name: 'خادم التكامل',
      algorithm: 'sha512',
      signatureHeader: 'X-Signature',
      signaturePrefix: '',
      eventHeader: 'x-event',
      deliveryHeader: 'x-delivery',
    })
    assert.equal(source.signatureHeader, 'x-signature')
    const payload = JSON.stringify({ status: 'passed' })
    const signature = createHmac('sha512', ciSecret).update(payload).digest('hex')
    const first = await inbound.receive('ci', {
      headers: { 'x-signature': signature, 'x-event': 'Build Finished!' },
      body: payload,
    })
    assert.equal(first.event, 'inbound.ci.build_finished')
    assert.match(first.delivery, /^sha256:[0-9a-f]{64}$/)
    const repeat = await inbound.receive('ci', {
      headers: { 'x-signature': signature, 'x-event': 'Build Finished!' },
      body: payload,
    })
    assert.isTrue(repeat.duplicate)
    assert.equal(inboundEventName('ci', ''), 'inbound.ci.received')
    await inbound.remove(source.id)
    assert.lengthOf(await db('inbound_deliveries').where('source_id', source.id), 0)
  })
})
