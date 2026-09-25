import { test } from '@japa/runner'
import { Assignments, KitError, ResourceService } from '../index.js'
import type { Actor } from '../index.js'
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

const outsider: Actor = {
  id: 3,
  orgPaths: ['1.3'],
  permissionLevel: 0,
  rules: [{ subject: 'orders', action: ['view', 'update'] }],
}
const viewer: Actor = {
  id: 4,
  orgPaths: ['1.2'],
  permissionLevel: 0,
  rules: [{ subject: 'orders', action: 'view' }],
}
const actors = new Map([admin, reader, outsider, viewer].map((actor) => [actor.id, actor]))

test.group('Assignments', (group) => {
  let orderId: number
  const service = () => new ResourceService(db, registry)
  const assignments = () => new Assignments(db, service(), { load: async (id) => actors.get(id)! })

  group.setup(async () => {
    await setup()
    await db.raw(
      'ALTER TABLE users ADD COLUMN full_name varchar, ADD COLUMN disabled_at timestamptz'
    )
    await db('users').where('id', 1).update({ full_name: 'مدير النظام' })
    await db('users').insert([
      { id: 3, email: 'outsider@example.test', full_name: 'خارجي' },
      { id: 4, email: 'viewer@example.test', full_name: 'مشاهدة' },
    ])
    const saved = await service().save('orders', admin, { notes: 'طلب للإسناد', orgUnitId: 2 })
    orderId = Number(saved.id)
  })
  group.each.setup(async () => {
    await db('assignments').del()
    await db('notifications').del()
  })

  test('an updater assigns a reader, who sees it in my tasks and completes it', async ({
    assert,
  }) => {
    const created = await assignments().assign('orders', orderId, reader, {
      assigneeId: 4,
      title: 'تدقيق الأسعار',
      dueOn: '2026-10-01',
      note: 'قبل نهاية الأسبوع',
    })
    assert.equal(created.status, 'open')
    assert.equal(created.dueOn, '2026-10-01')
    assert.isTrue(created.canCancel)
    assert.isFalse(created.canComplete)
    const inbox = await db('notifications').where('user_id', 4)
    assert.lengthOf(inbox, 1)
    assert.equal(inbox[0].title, 'مهمة جديدة مسندة إليك')

    const mine = await assignments().mine(viewer)
    assert.equal(mine.open, 1)
    assert.lengthOf(mine.data, 1)
    assert.isTrue(mine.data[0].canComplete)
    assert.equal(mine.data[0].resourceLabel, 'الطلبات')

    await assignments().complete(created.id, viewer)
    const done = await assignments().mine(viewer, { status: 'done' })
    assert.equal(done.data[0].status, 'done')
    const reopened = await assignments().mine(viewer)
    assert.equal(reopened.open, 0)
    const back = await db('notifications').where('user_id', 2)
    assert.equal(back[0].title, 'أُنجزت مهمة أسندتها')
    const again = await failure(() => assignments().complete(created.id, viewer))
    assert.equal(again.code, 'E_ASSIGNMENT_CLOSED')
  })

  test('assigning requires update access and an assignee who can read the record', async ({
    assert,
  }) => {
    const readOnly = await failure(() =>
      assignments().assign('orders', orderId, viewer, { assigneeId: 2, title: 'x' })
    )
    assert.equal(readOnly.status, 403)
    const foreign = await failure(() =>
      assignments().assign('orders', orderId, reader, { assigneeId: 3, title: 'x' })
    )
    assert.equal(foreign.code, 'E_ASSIGNEE')
    const badDate = await failure(() =>
      assignments().assign('orders', orderId, reader, {
        assigneeId: 4,
        title: 'x',
        dueOn: '2026-13-45',
      })
    )
    assert.equal(badDate.code, 'E_ASSIGNMENT_DUE')
    const outside = await failure(() =>
      assignments().assign('orders', orderId, outsider, { assigneeId: 2, title: 'x' })
    )
    assert.equal(outside.status, 404)
  })

  test('only the assignee completes and only the assigner cancels', async ({ assert }) => {
    const created = await assignments().assign('orders', orderId, reader, {
      assigneeId: 4,
      title: 'مهمة',
    })
    const wrongCompleter = await failure(() => assignments().complete(created.id, reader))
    assert.equal(wrongCompleter.status, 403)
    const wrongCanceller = await failure(() =>
      assignments().complete(created.id, viewer, 'cancelled')
    )
    assert.equal(wrongCanceller.status, 403)
    const stranger = await failure(() => assignments().complete(created.id, admin))
    assert.equal(stranger.status, 404)
    await assignments().complete(created.id, reader, 'cancelled')
    const [row] = await db('assignments').where('id', created.id)
    assert.equal(row.status, 'cancelled')
  })

  test('tasks on records the assignee can no longer read are hidden', async ({ assert }) => {
    await assignments().assign('orders', orderId, reader, { assigneeId: 4, title: 'مرئية' })
    const other = await service().save('orders', admin, { notes: 'منقول', orgUnitId: 2 })
    await assignments().assign('orders', Number(other.id), reader, {
      assigneeId: 4,
      title: 'ستختفي',
    })
    await db('orders').where('id', Number(other.id)).update({ org_unit_id: 3 })
    const mine = await assignments().mine(viewer)
    assert.deepEqual(
      mine.data.map((entry) => entry.title),
      ['مرئية']
    )
    const recordList = await assignments().forRecord('orders', orderId, admin)
    assert.lengthOf(recordList, 1)
  })

  test('workflow approval assignments cannot be completed as plain tasks', async ({ assert }) => {
    const created = await assignments().create(db, {
      resource: 'orders',
      recordId: orderId,
      assigneeId: 4,
      assignedBy: null,
      title: 'موافقة المدير',
      kind: 'approval',
      workflowRunId: '00000000-0000-4000-8000-000000000001',
      workflowStep: 'manager',
    })
    const error = await failure(() => assignments().complete(created.id, viewer))
    assert.equal(error.code, 'E_ASSIGNMENT_WORKFLOW')
    const inbox = await db('notifications').where('user_id', 4)
    assert.equal(inbox[0].title, 'موافقة مطلوبة منك')
  })
})
