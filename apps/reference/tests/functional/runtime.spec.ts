import { test } from '@japa/runner'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import queue from '@nemoventures/adonis-jobs/services/main'
import cache from '@adonisjs/cache/services/main'
import User from '#models/user'
import { kit } from '#services/kit'
import { jobs } from '#services/events'

test.group('Real Redis cache and queue delivery', (group) => {
  let worker: ChildProcess
  let output = ''
  let user: User
  let orgId: number
  let roleId: number
  const knex = () => db.connection().getWriteClient()
  const startWorker = () => {
    output = ''
    worker = spawn(process.execPath, ['ace', 'adula:worker'], {
      cwd: app.appRoot,
      env: { ...process.env, NODE_ENV: 'test' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    worker.stdout?.on('data', (data) => {
      output += data
    })
    worker.stderr?.on('data', (data) => {
      output += data
    })
  }
  const stopWorker = async () => {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      const exited = new Promise<void>((resolve) => worker.once('exit', () => resolve()))
      worker.kill('SIGTERM')
      await exited
    }
  }
  group.setup(async () => {
    await redis.ping()
    user = await User.create({
      email: 'runtime@example.test',
      fullName: 'مدير التشغيل',
      password: 'test-only-password-123',
    })
    const [org] = await knex()('org_units')
      .insert({ name: 'تشغيل', type: 'root', path: '777' })
      .returning('id')
    orgId = org.id
    const [role] = await knex()('roles')
      .insert({ name: 'runtime-admin', permission_level: 1 })
      .returning('id')
    roleId = role.id
    await knex()('user_roles').insert({ user_id: user.id, role_id: roleId })
    await knex()('user_org_units').insert({ user_id: user.id, org_unit_id: orgId })
    await knex()('role_rules').insert({ role_id: roleId, subject: 'all', action: 'manage' })
    startWorker()
    return stopWorker
  })
  test('revision invalidates a cached actor immediately after a rule or membership changes', async ({
    assert,
  }) => {
    const actors = kit().actors
    const before = await actors.load(user.id)
    const cached = await actors.load(user.id)
    assert.deepEqual(cached.orgPaths, before.orgPaths)
    assert.equal(cached.rules[0].action, 'manage')
    await knex()('role_rules')
      .where({ role_id: roleId })
      .update({ action: 'view', subject: 'orders' })
    const changed = await actors.load(user.id)
    assert.equal(changed.rules[0].action, 'view')
    await knex()('user_org_units').where({ user_id: user.id }).delete()
    const withoutMembership = await actors.load(user.id)
    assert.deepEqual(withoutMembership.orgPaths, [])
    await knex()('user_org_units').insert({ user_id: user.id, org_unit_id: orgId })
    await knex()('role_rules')
      .where({ role_id: roleId })
      .update({ action: 'manage', subject: 'all' })
  })
  test('worker publishes the committed event and duplicate queue delivery creates one task', async ({
    assert,
  }) => {
    const { resources, actors } = kit()
    const actor = await actors.load(user.id)
    const order = await resources.save('orders', actor, {
      orgUnitId: orgId,
      notes: 'اختبار تسليم حقيقي',
    })
    await resources.transition('orders', Number(order.id), actor, 'submit', order.version)
    const event = await knex()('outbox')
      .where({ event: 'orders.orders.submitted' })
      .whereRaw("payload->>'id' = ?", [String(order.id)])
      .first()
    const waitUntil = async (predicate: () => Promise<boolean>) => {
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        if (await predicate()) return
        if (worker.exitCode !== null) throw new Error(`Worker exited: ${output}`)
        await setTimeout(100)
      }
      throw new Error(`Worker timed out: ${output}`)
    }
    await waitUntil(async () =>
      Boolean(
        await knex()('processed_events')
          .where({ event_id: event.id, listener: 'tasks.create_submission_followup' })
          .first()
      )
    )
    const firstJob = await queue.useQueue('events').getJob(event.id)
    assert.exists(firstJob)
    await waitUntil(async () => await firstJob!.isCompleted())
    // Force a second real delivery, even after the original queue record is pruned.
    await firstJob!.remove()
    await jobs.dispatch('adula.domain_event', event, { id: event.id })
    const repeated = await queue.useQueue('events').getJob(event.id)
    await waitUntil(async () => await repeated!.isCompleted())
    assert.lengthOf(await knex()('tasks').where('order_id', Number(order.id)), 1)
    // Each listener consumes the event once; follower notifications are a second listener.
    assert.lengthOf(
      await knex()('processed_events').where({
        event_id: event.id,
        listener: 'tasks.create_submission_followup',
      }),
      1
    )
    assert.lengthOf(
      await knex()('processed_events').where({
        event_id: event.id,
        listener: 'kit.followers.orders.orders.submitted',
      }),
      1
    )
    const published = await knex()('outbox').where('id', event.id).first()
    assert.isNotNull(published.published_at)
    assert.exists(await knex()('settings').where('key', 'worker.heartbeat').first())
    // Queue IDs are outbox UUIDs, not process-local counters.
    assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  test('restore reconciliation clears stale queue state and replays without repeating effects', async ({
    assert,
  }) => {
    await stopWorker()
    const before = await knex()('tasks').select('id').orderBy('id')
    const events = await knex()('processed_events')
      .select('event_id', 'listener')
      .orderBy('event_id')
    assert.isAbove(events.length, 0)
    const command = spawn(process.execPath, ['ace', 'adula:restore:reconcile', '--force'], {
      cwd: app.appRoot,
      env: { ...process.env, NODE_ENV: 'test' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let result = ''
    command.stdout?.on('data', (data) => {
      result += data
    })
    command.stderr?.on('data', (data) => {
      result += data
    })
    const exit = await new Promise((resolve) => command.once('exit', resolve))
    assert.equal(exit, 0, result)
    const pending = await knex()('outbox').whereNull('published_at')
    assert.isAbove(pending.length, 0)
    assert.equal(
      await queue
        .useQueue('events')
        .getJobCountByTypes('wait', 'active', 'completed', 'failed', 'delayed'),
      0
    )
    // Restarting a web process also discards its L1 cache; revision keys invalidate live L1 entries.
    await cache.clear()
    startWorker()
    const deadline = Date.now() + 15000
    let complete = false
    while (Date.now() < deadline) {
      const rows = await knex()('outbox').whereNull('published_at')
      const queued = await queue.useQueue('events').getJobCountByTypes('wait', 'active', 'delayed')
      if (!rows.length && queued === 0) {
        complete = true
        break
      }
      if (worker.exitCode !== null) throw new Error(output)
      await setTimeout(100)
    }
    assert.isTrue(complete, output)
    assert.equal(await queue.useQueue('events').getJobCountByTypes('failed'), 0)
    assert.isAtLeast(await queue.useQueue('events').getJobCountByTypes('completed'), pending.length)
    assert.deepEqual(await knex()('tasks').select('id').orderBy('id'), before)
    assert.deepEqual(
      await knex()('processed_events').select('event_id', 'listener').orderBy('event_id'),
      events
    )
  })
})
