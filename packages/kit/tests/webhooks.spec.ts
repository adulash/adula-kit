import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from '@japa/runner'
import {
  KitError,
  ResourceService,
  Webhooks,
  WEBHOOK_MAX_ATTEMPTS,
  consumeEvent,
  signWebhook,
  publishOutbox,
} from '../index.js'
import type { DomainEvent, HttpPoster, SecretBox, WebhookOptions } from '../index.js'
import { admin, db, registry, setup } from './helpers.js'

async function failure(run: () => Promise<unknown>): Promise<KitError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof KitError) return error
    throw error
  }
  throw new Error('Expected a KitError')
}

/** A reversible test box; production passes the framework's authenticated encryption. */
const box: SecretBox = {
  seal: (value) => `sealed:${Buffer.from(value).toString('base64')}`,
  open: (value) =>
    value.startsWith('sealed:') ? Buffer.from(value.slice(7), 'base64').toString() : null,
}
const fetchPoster: HttpPoster = async (url, init) => {
  const response = await fetch(url, { method: 'POST', ...init })
  return { status: response.status }
}

test.group('Outgoing webhooks', (group) => {
  group.setup(async () => {
    await setup()
    await db.raw(
      'ALTER TABLE users ADD COLUMN full_name varchar, ADD COLUMN disabled_at timestamptz'
    )
  })
  group.each.setup(async () => {
    await db('webhook_deliveries').del()
    await db('webhooks').del()
    await db('processed_events').del()
    await db('outbox').del()
    await db('notifications').del()
  })

  const hooks = (options: WebhookOptions = { allowPrivateTargets: true }) =>
    new Webhooks(db, registry, box, options)

  async function drainEvents(webhooks: Webhooks) {
    const events: DomainEvent[] = []
    await publishOutbox(db, {
      dispatch: async (_, payload) => {
        events.push(payload as unknown as DomainEvent)
      },
    })
    for (const event of events) await consumeEvent(db, webhooks.listener(), event)
    return events
  }

  test('rejects insecure, credentialed and private targets unless explicitly allowed', async ({
    assert,
  }) => {
    const strict = hooks({
      allowPrivateTargets: false,
      resolve: async (host: string) =>
        host === 'intranet.example' ? ['10.0.0.5'] : ['93.184.216.34'],
    })
    const events = ['orders.orders.created']
    for (const url of [
      'http://hooks.example/x',
      'https://user:pw@hooks.example/x',
      'https://127.0.0.1/x',
      'https://[::1]/x',
      'https://169.254.169.254/latest',
      'https://intranet.example/x',
      'not a url',
    ]) {
      const error = await failure(() => strict.create(1, { name: 'x', url, events }))
      assert.equal(error.code, 'E_WEBHOOK_URL', url)
    }
    const created = await strict.create(1, { name: 'عام', url: 'https://hooks.example/x', events })
    assert.equal(created.webhook.url, 'https://hooks.example/x')
    const unknown = await failure(() =>
      strict.create(1, { name: 'x', url: 'https://hooks.example/x', events: ['orders.nope'] })
    )
    assert.equal(unknown.code, 'E_WEBHOOK_EVENTS')
    const stored = await db('webhooks').where('id', created.webhook.id).first()
    assert.notEqual(stored.secret, created.secret)
    assert.equal(box.open(stored.secret), created.secret)
  })

  test('signed delivery reaches the endpoint once per event', async ({ assert }) => {
    const received: { headers: IncomingMessage['headers']; body: string }[] = []
    const server = createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        received.push({ headers: request.headers, body })
        response.writeHead(204).end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const port = (server.address() as AddressInfo).port
      const webhooks = hooks()
      const { webhook, secret } = await webhooks.create(1, {
        name: 'نظام المحاسبة',
        url: `http://127.0.0.1:${port}/hook`,
        events: ['orders.orders.created'],
      })
      const saved = await new ResourceService(db, registry).save('orders', admin, {
        notes: 'حدث للويب هوك',
        orgUnitId: 2,
      })
      const [event] = await drainEvents(webhooks)
      // Redelivery of the same domain event queues nothing new.
      await consumeEvent(db, webhooks.listener(), event)
      const result = await webhooks.deliver(fetchPoster)
      assert.deepEqual(result, { delivered: 1, failed: 0 })
      assert.lengthOf(received, 1)
      const [call] = received
      const timestamp = String(call.headers['x-adula-timestamp'])
      assert.equal(
        call.headers['x-adula-signature'],
        `sha256=${signWebhook(secret, timestamp, call.body)}`
      )
      const payload = JSON.parse(call.body)
      assert.equal(payload.event, 'orders.orders.created')
      assert.equal(payload.recordId, saved.id)
      assert.notProperty(payload, 'notes')
      const log = await webhooks.deliveries(webhook.id)
      assert.equal(log[0].status, 'delivered')
      assert.deepEqual(await webhooks.deliver(fetchPoster), { delivered: 0, failed: 0 })
    } finally {
      server.close()
    }
  })

  test('failures back off, stop after the last attempt, notify the creator and can be retried', async ({
    assert,
  }) => {
    const webhooks = hooks()
    const { webhook } = await webhooks.create(1, {
      name: 'معطل',
      url: 'http://127.0.0.1:9/down',
      events: ['orders.orders.created'],
    })
    await new ResourceService(db, registry).save('orders', admin, { notes: 'x', orgUnitId: 2 })
    await drainEvents(webhooks)
    const refusing: HttpPoster = async () => ({ status: 500 })
    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
      await db('webhook_deliveries').update({ next_attempt_at: db.fn.now() })
      const result = await webhooks.deliver(refusing)
      assert.equal(result.failed, 1)
      const [row] = await db('webhook_deliveries')
      assert.equal(row.attempts, attempt)
      assert.equal(row.status, attempt < WEBHOOK_MAX_ATTEMPTS ? 'pending' : 'failed')
      if (attempt === 1)
        assert.isAbove(new Date(row.next_attempt_at).getTime(), Date.now() + 30_000)
    }
    const [hook] = await db('webhooks').where('id', webhook.id)
    assert.equal(hook.failing, 1)
    const notices = await db('notifications').where('user_id', 1)
    assert.lengthOf(notices, 1)
    assert.include(notices[0].title, 'معطل')

    const [failed] = await webhooks.deliveries(webhook.id)
    await webhooks.retry(failed.id)
    const ok = await webhooks.deliver(async () => ({ status: 200 }))
    assert.deepEqual(ok, { delivered: 1, failed: 0 })
  })

  test('inactive webhooks and unsubscribed events queue nothing', async ({ assert }) => {
    const webhooks = hooks()
    const { webhook } = await webhooks.create(1, {
      name: 'متوقف',
      url: 'http://127.0.0.1:9/x',
      events: ['orders.orders.updated'],
    })
    await new ResourceService(db, registry).save('orders', admin, { notes: 'y', orgUnitId: 2 })
    await drainEvents(webhooks)
    assert.lengthOf(await db('webhook_deliveries'), 0)
    await webhooks.update(webhook.id, {
      name: 'متوقف',
      url: 'http://127.0.0.1:9/x',
      events: ['orders.orders.created'],
      active: false,
    })
    await new ResourceService(db, registry).save('orders', admin, { notes: 'z', orgUnitId: 2 })
    await drainEvents(webhooks)
    assert.lengthOf(await db('webhook_deliveries'), 0)
  })
})
