import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from '@japa/runner'
import {
  Assignments,
  KitError,
  ResourceService,
  WorkflowEngine,
  consumeEvent,
  defineWorkflow,
  publishOutbox,
} from '../index.js'
import type {
  Actor,
  DomainEvent,
  HttpPoster,
  WorkflowDefinition,
  WorkflowOptions,
} from '../index.js'
import { admin, db, reader, registry, setup } from './helpers.js'

async function failure(run: () => Promise<unknown>): Promise<KitError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof KitError) return error
    throw error
  }
  throw new Error('Expected a KitError')
}

const manager: Actor = {
  id: 3,
  orgPaths: ['1.2'],
  permissionLevel: 1,
  rules: [{ subject: 'orders', action: 'view' }],
}
const director: Actor = {
  id: 4,
  orgPaths: ['1'],
  permissionLevel: 1,
  rules: [{ subject: 'orders', action: 'view' }],
}
const actors = new Map([admin, reader, manager, director].map((actor) => [actor.id, actor]))

/** Two-level approval: large orders need the manager and then the director. */
function approval(version = 1): WorkflowDefinition {
  return defineWorkflow({
    name: 'order_approval',
    version,
    resource: 'orders',
    label: 'اعتماد الطلب',
    start: 'size',
    steps: {
      size: {
        type: 'condition',
        when: (order) => Number(order.total ?? 0) >= 100000,
        then: 'manager',
        else: 'approved',
      },
      manager: {
        type: 'approval',
        label: 'موافقة مدير القسم',
        assignees: { users: [3] },
        approve: 'director',
        reject: 'rejected',
      },
      director: {
        type: 'approval',
        label: 'موافقة المدير العام',
        assignees: { users: [4] },
        approve: 'mark',
        reject: 'rejected',
      },
      mark: { type: 'update', values: { status: 'closed' }, next: 'tell' },
      tell: { type: 'notify', to: 'submitter', next: 'approved' },
      approved: { type: 'end', outcome: 'approved' },
      rejected: { type: 'end', outcome: 'rejected', cancelDocument: true },
    },
  })
}

test.group('Workflow engine', (group) => {
  const service = () => new ResourceService(db, registry)
  const assignments = () => new Assignments(db, service(), { load: async (id) => actors.get(id)! })
  const engine = (
    definitions: WorkflowDefinition[] = [approval()],
    options: WorkflowOptions = {}
  ) =>
    new WorkflowEngine(
      db,
      registry,
      service(),
      { load: async (id) => actors.get(id)! },
      assignments(),
      definitions,
      options
    )

  group.setup(async () => {
    await setup()
    await db.raw(
      'ALTER TABLE users ADD COLUMN full_name varchar, ADD COLUMN disabled_at timestamptz'
    )
    await db('users').insert([
      { id: 3, email: 'manager@example.test', full_name: 'مدير القسم' },
      { id: 4, email: 'director@example.test', full_name: 'المدير العام' },
    ])
  })
  group.each.setup(async () => {
    await db('workflow_events').del()
    await db('assignments').del()
    await db('workflow_runs').del()
    await db('processed_events').del()
    await db('outbox').del()
  })

  async function deliver(workflows: WorkflowEngine) {
    const events: DomainEvent[] = []
    await publishOutbox(db, {
      dispatch: async (_, payload) => {
        events.push(payload as unknown as DomainEvent)
      },
    })
    for (const event of events)
      for (const listener of workflows.listeners()) await consumeEvent(db, listener, event)
  }

  async function submittedOrder(total: string) {
    const saved = await service().save('orders', reader, { notes: 'طلب تدفق', orgUnitId: 2 })
    await db('orders').where('id', Number(saved.id)).update({ total })
    const shown = await service().show('orders', Number(saved.id), admin)
    await service().transition('orders', Number(saved.id), reader, 'submit', shown.data.version)
    return Number(saved.id)
  }

  test('rejects invalid definitions before they run', ({ assert }) => {
    assert.throws(
      () =>
        defineWorkflow({
          name: 'broken',
          version: 1,
          resource: 'orders',
          label: 'x',
          start: 'a',
          steps: {
            a: { type: 'delay', ms: 10, next: 'missing' },
            b: { type: 'end', outcome: 'completed' },
          },
        }),
      /unknown step missing/
    )
    assert.throws(() => engine([approval(), approval()]), /Duplicate workflow version/)
    assert.throws(
      () =>
        engine([
          defineWorkflow({
            name: 'on_customers',
            version: 1,
            resource: 'customers',
            label: 'x',
            start: 'done',
            steps: { done: { type: 'end', outcome: 'completed' } },
          }),
        ]),
      /submittable/
    )
  })

  test('two-level approval from submission to approval without UI code', async ({ assert }) => {
    const workflows = engine()
    const id = await submittedOrder('250000')
    await deliver(workflows)
    let [run] = await workflows.runsFor('orders', id, admin)
    assert.equal(run.status, 'waiting')
    assert.equal(run.step, 'manager')
    // Only the assigned approver may decide, and only at the current step.
    const early = await failure(() => workflows.decide(run.id, director, 'approve'))
    assert.equal(early.code, 'E_WORKFLOW_STATE')
    const inbox = await workflows.inbox(manager)
    assert.deepEqual(
      inbox.map((entry) => entry.id),
      [run.id]
    )
    run = await workflows.decide(run.id, manager, 'approve', 'الأسعار مطابقة')
    assert.equal(run.step, 'director')
    run = await workflows.decide(run.id, director, 'approve')
    assert.equal(run.status, 'completed')
    assert.equal(run.outcome, 'approved')
    const order = await db('orders').where('id', id).first()
    assert.equal(order.status, 'closed')
    assert.equal(order.doc_status, 1)
    const history = run.history.map((entry) => entry.event)
    assert.deepEqual(history, [
      'started',
      'evaluate',
      'approval_requested',
      'approved',
      'approval_requested',
      'approved',
      'done',
      'done',
      'completed',
    ])
    assert.equal(run.history[3].detail.comment, 'الأسعار مطابقة')
    const notice = await db('notifications')
      .where('user_id', reader.id)
      .orderBy('id', 'desc')
      .first()
    assert.include(notice.body, 'اعتماد الطلب')
    const changes = await db('field_changes').where({
      resource: 'orders',
      record_id: id,
      field: 'status',
    })
    assert.lengthOf(changes, 1)
  })

  test('small orders skip approval; rejection cancels the document', async ({ assert }) => {
    const workflows = engine()
    const small = await submittedOrder('100')
    const large = await submittedOrder('900000')
    await deliver(workflows)
    const [done] = await workflows.runsFor('orders', small, admin)
    assert.equal(done.outcome, 'approved')
    const [waiting] = await workflows.runsFor('orders', large, admin)
    const rejected = await workflows.decide(waiting.id, manager, 'reject', 'تجاوز الميزانية')
    assert.equal(rejected.outcome, 'rejected')
    const order = await db('orders').where('id', large).first()
    assert.equal(order.doc_status, 2)
    const open = await db('assignments').where({ workflow_run_id: waiting.id, status: 'open' })
    assert.lengthOf(open, 0)
  })

  test('a crash between effect and commit loses no state and repeats no effect', async ({
    assert,
  }) => {
    let crash = true
    const workflows = engine([approval()], {
      beforeCommit: ({ step }) => {
        if (step === 'mark' && crash) {
          crash = false
          throw new Error('worker stopped')
        }
      },
    })
    const id = await submittedOrder('300000')
    await deliver(workflows)
    let [run] = await workflows.runsFor('orders', id, admin)
    await workflows.decide(run.id, manager, 'approve')
    run = await workflows.decide(run.id, director, 'approve')
    // The update step's write was rolled back with the failed step; the run waits to retry.
    assert.equal(run.status, 'running')
    assert.equal(run.step, 'mark')
    assert.equal(run.attempts, 1)
    const unchanged = await db('orders').where('id', id).first()
    assert.notEqual(unchanged.status, 'closed')
    await db('workflow_runs').where('id', run.id).update({ wake_at: new Date(Date.now() - 1000) })
    await workflows.tick()
    run = await workflows.run(run.id, admin)
    assert.equal(run.status, 'completed')
    const changes = await db('field_changes').where({
      resource: 'orders',
      record_id: id,
      field: 'status',
    })
    assert.lengthOf(changes, 1)
  })

  test('a new definition version does not change a running workflow', async ({ assert }) => {
    const id = await submittedOrder('500000')
    await deliver(engine())
    const [started] = await engine().runsFor('orders', id, admin)
    assert.equal(started.version, 1)
    // Version 2 removes the director level; the running v1 still requires it.
    const v2 = defineWorkflow({
      name: 'order_approval',
      version: 2,
      resource: 'orders',
      label: 'اعتماد الطلب ٢',
      start: 'manager',
      steps: {
        manager: {
          type: 'approval',
          label: 'موافقة',
          assignees: { users: [3] },
          approve: 'ok',
          reject: 'no',
        },
        ok: { type: 'end', outcome: 'approved' },
        no: { type: 'end', outcome: 'rejected' },
      },
    })
    const both = engine([approval(), v2])
    const after = await both.decide(started.id, manager, 'approve')
    assert.equal(after.version, 1)
    assert.equal(after.step, 'director')
    // New submissions start on the newest version.
    const next = await submittedOrder('10')
    await deliver(both)
    const [fresh] = await both.runsFor('orders', next, admin)
    assert.equal(fresh.version, 2)
    // Explicit migration moves unfinished v1 runs.
    const moved = await both.migrateRuns('order_approval', 1, 2, () => 'manager')
    assert.equal(moved, 1)
  })

  test('a run whose version is no longer registered stops instead of guessing', async ({
    assert,
  }) => {
    const id = await submittedOrder('400000')
    await deliver(engine())
    const [run] = await engine().runsFor('orders', id, admin)
    await db('workflow_runs')
      .where('id', run.id)
      .update({ status: 'running', wake_at: new Date(Date.now() - 1000) })
    const withoutV1 = engine([
      defineWorkflow({
        name: 'order_approval',
        version: 3,
        resource: 'orders',
        label: 'x',
        start: 'end',
        steps: { end: { type: 'end', outcome: 'completed' } },
      }),
    ])
    await withoutV1.tick()
    const stopped = await withoutV1.run(run.id, admin)
    assert.equal(stopped.status, 'failed')
    assert.include(stopped.lastError, 'order_approval@1 is not registered')
  })

  test('concurrent decisions under the row lock apply once', async ({ assert }) => {
    const workflows = engine()
    const id = await submittedOrder('700000')
    await deliver(workflows)
    const [run] = await workflows.runsFor('orders', id, admin)
    const results = await Promise.allSettled([
      workflows.decide(run.id, manager, 'approve'),
      workflows.decide(run.id, manager, 'reject'),
    ])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const decisions = await db('workflow_events')
      .where({ run_id: run.id })
      .whereIn('event', ['approved', 'rejected'])
    assert.lengthOf(decisions, 1)
  })

  test('delay, HTTP with a stable idempotency key, bounded retries and admin retry', async ({
    assert,
  }) => {
    const keys: string[] = []
    let failures = 2
    const server = createServer((request, response) => {
      keys.push(String(request.headers['idempotency-key']))
      if (failures-- > 0) response.writeHead(503).end()
      else response.writeHead(200).end('{}')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    let clock = new Date()
    const post: HttpPoster = async (url, init) => {
      const response = await fetch(url, { method: 'POST', ...init })
      return { status: response.status }
    }
    try {
      const port = (server.address() as AddressInfo).port
      const flow = defineWorkflow({
        name: 'order_sync',
        version: 1,
        resource: 'orders',
        label: 'مزامنة الطلب',
        start: 'wait',
        maxAttempts: 3,
        steps: {
          wait: { type: 'delay', ms: 3600000, next: 'push' },
          push: { type: 'http', url: `http://127.0.0.1:${port}/sync`, next: 'done' },
          done: { type: 'end', outcome: 'completed' },
        },
      })
      const workflows = engine([flow], { post, now: () => clock })
      const id = await submittedOrder('1')
      await deliver(workflows)
      let [run] = await workflows.runsFor('orders', id, admin)
      assert.equal(run.step, 'wait')
      assert.equal(await workflows.tick(), 0)
      clock = new Date(clock.getTime() + 3600000 + 1000)
      await workflows.tick()
      run = await workflows.run(run.id, admin)
      assert.equal(run.step, 'push')
      assert.equal(run.attempts, 1)
      clock = new Date(clock.getTime() + 60_000)
      await workflows.tick()
      run = await workflows.run(run.id, admin)
      assert.equal(run.attempts, 2)
      // Retries use the same key, so the receiver can apply the call once.
      assert.deepEqual([...new Set(keys)], [`${run.id}:push`])
      clock = new Date(clock.getTime() + 600_000)
      failures = 5
      await workflows.tick()
      run = await workflows.run(run.id, admin)
      assert.equal(run.status, 'failed')
      const failed = await workflows.failed()
      assert.include(
        failed.map((entry) => entry.id),
        run.id
      )
      failures = 0
      await workflows.retry(run.id, admin.id)
      await workflows.tick()
      run = await workflows.run(run.id, admin)
      assert.equal(run.status, 'completed')
    } finally {
      server.close()
    }
  })

  test('cancelling the document stops the run and its open approvals', async ({ assert }) => {
    const workflows = engine()
    const id = await submittedOrder('800000')
    await deliver(workflows)
    const shown = await service().show('orders', id, admin)
    await service().transition('orders', id, admin, 'cancel', shown.data.version)
    await deliver(workflows)
    const [run] = await workflows.runsFor('orders', id, admin)
    assert.equal(run.status, 'cancelled')
    assert.lengthOf(await db('assignments').where({ workflow_run_id: run.id, status: 'open' }), 0)
    const amended = await service().amend('orders', id, admin)
    assert.equal(amended.docStatus, 0)
    const copy = await db('orders').where('id', Number(amended.id)).first()
    assert.equal(copy.amended_from_id, id)
    assert.notEqual(copy.number, shown.data.number)
    const again = await failure(() => service().amend('orders', id, admin))
    assert.equal(again.code, 'E_ALREADY_AMENDED')
    const draft = await failure(() => service().amend('orders', Number(amended.id), admin))
    assert.equal(draft.code, 'E_DOCUMENT_STATE')
  })
})
