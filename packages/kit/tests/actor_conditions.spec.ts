import { test } from '@japa/runner'
import {
  ACTOR_ID,
  ActorStore,
  KitError,
  ResourceService,
  RolesAdmin,
  accessibleBy,
  buildAbility,
  resolveActorConditions,
} from '../index.js'
import { db, order, registry, setup } from './helpers.js'

async function failure(run: () => Promise<unknown>): Promise<KitError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof KitError) return error
    throw error
  }
  throw new Error('Expected a KitError')
}

test.group('Current-actor conditions ($actor.id)', (group) => {
  const roles = new RolesAdmin(db, registry)
  const service = () => new ResourceService(db, registry)
  let roleId = 0
  group.setup(async () => {
    await setup()
    // Host applications own users; the reference migration adds these two columns.
    await db.raw(
      'ALTER TABLE users ADD COLUMN full_name varchar, ADD COLUMN disabled_at timestamptz'
    )
    const role = await roles.create(1, { name: 'محرر طلباته', key: 'own_orders' })
    roleId = role.id
    // Everyone in the unit reads orders; each user edits only the orders they created.
    await roles.setRule(1, roleId, { subject: 'orders', action: 'view' })
    await roles.setRule(1, roleId, { subject: 'orders', action: 'create' })
    await roles.setRule(1, roleId, {
      subject: 'orders',
      action: 'update',
      conditions: { createdBy: ACTOR_ID },
    })
    await db('users').insert({ id: 3, email: 'colleague@example.test' })
    await db('user_roles').insert([
      { user_id: 2, role_id: roleId },
      { user_id: 3, role_id: roleId },
    ])
    await db('user_org_units').insert([
      { user_id: 2, org_unit_id: 2 },
      { user_id: 3, org_unit_id: 2 },
    ])
  })

  test('each user may update only the records they created, in CASL and SQL alike', async ({
    assert,
  }) => {
    const store = new ActorStore(db, registry)
    const mine = await store.load(2)
    const colleague = await store.load(3)
    const update = mine.rules.find((rule) => rule.action === 'update')
    assert.deepEqual(update?.conditions, { createdBy: 2 })
    const own = await service().save('orders', mine, { notes: 'طلبي', orgUnitId: 2 })
    const theirs = await service().save('orders', colleague, { notes: 'طلب الزميل', orgUnitId: 2 })
    const page = await service().list('orders', mine)
    assert.isTrue(page.permissions[String(own.id)].update)
    assert.isFalse(page.permissions[String(theirs.id)].update)
    // Both records remain visible; only the update right follows the creator.
    assert.includeMembers(
      page.data.map((row) => row.id),
      [own.id, theirs.id]
    )
    const editable = await accessibleBy(
      db('orders as r').whereNull('r.deleted_at'),
      buildAbility(mine.rules, registry.all()),
      mine,
      'update',
      order
    ).pluck('r.id')
    assert.include(editable, Number(own.id))
    assert.notInclude(editable, Number(theirs.id))
    const denied = await failure(() =>
      service().save(
        'orders',
        mine,
        { notes: 'تعديل غير مسموح', version: theirs.version },
        Number(theirs.id)
      )
    )
    assert.equal(denied.status, 403)
    const saved = await service().save(
      'orders',
      mine,
      { notes: 'طلبي المعدل', version: own.version },
      Number(own.id)
    )
    assert.equal(saved.notes, 'طلبي المعدل')
    // The stored rule keeps the placeholder; only the loaded actor carries an id.
    const stored = await db('role_rules').where({ role_id: roleId, action: 'update' }).first()
    assert.deepEqual(stored.conditions, { createdBy: ACTOR_ID })
  })

  test('the placeholder is limited to user fields and equality operators', async ({ assert }) => {
    const reject = async (conditions: Record<string, unknown>) => {
      const error = await failure(() =>
        roles.setRule(1, roleId, { subject: 'orders', action: 'delete', conditions } as never)
      )
      return error.code
    }
    assert.equal(await reject({ notes: ACTOR_ID }), 'E_RULE_CONDITIONS')
    assert.equal(await reject({ createdBy: { $lt: ACTOR_ID } }), 'E_RULE_CONDITIONS')
    const listed = await roles.setRule(1, roleId, {
      subject: 'orders',
      action: 'delete',
      conditions: { updatedBy: { $in: [ACTOR_ID, 1] } },
    })
    assert.deepEqual(listed.conditions, { updatedBy: { $in: [ACTOR_ID, 1] } })
    assert.deepEqual(resolveActorConditions({ updatedBy: { $in: [ACTOR_ID, 1] } }, 7), {
      updatedBy: { $in: [7, 1] },
    })
    const matrix = roles.matrix().subjects.find((entry) => entry.name === 'orders')!
    const actorFields = matrix.conditionFields.filter((field) => field.actor).map((f) => f.key)
    assert.deepEqual(actorFields, ['createdBy', 'updatedBy'])
  })
})
