import { test } from '@japa/runner'
import { BaseModel } from '@adonisjs/lucid/orm'
import {
  KitError,
  ResourceRegistry,
  ResourceService,
  conditionSql,
  createResourceTable,
  defineResource,
} from '../index.js'
import type { Actor, RecordData } from '../index.js'
import { db, setup } from './helpers.js'

const ticket = defineResource({
  name: 'tickets',
  label: { ar: 'التذاكر', en: 'Tickets' },
  model: BaseModel,
  scoped: true,
  fields: {
    title: { type: 'string', required: true, label: { ar: 'العنوان', en: 'Title' } },
    assignee: {
      type: 'user',
      filterable: true,
      sortable: true,
      label: { ar: 'المكلف', en: 'Assignee' },
    },
  },
  list: ['title', 'assignee'],
  form: ['title', 'assignee'],
  show: ['title', 'assignee'],
  actions: ['view', 'create', 'update', 'delete'],
  validator: { validate: async (data) => data as RecordData },
})
const registry = new ResourceRegistry().register([
  { name: 'support', label: { ar: 'الدعم', en: 'Support' }, dependsOn: [], resources: [ticket] },
])
/** Works in unit A (path 1.2). */
const agent: Actor = {
  id: 2,
  orgPaths: ['1.2'],
  permissionLevel: 0,
  rules: [{ subject: 'tickets', action: 'manage' }],
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

test.group('User fields', (group) => {
  const service = () => new ResourceService(db, registry)
  group.setup(async () => {
    await setup()
    await db.raw(
      'ALTER TABLE users ADD COLUMN full_name varchar, ADD COLUMN disabled_at timestamptz'
    )
    await db('users').where('id', 1).update({ full_name: 'مدير النظام' })
    await db('users').where('id', 2).update({ full_name: 'سارة الوكيلة' })
    await db('users').insert([
      { id: 3, email: 'sibling@example.test', full_name: 'خالد من الوحدة ب' },
      { id: 4, email: 'root@example.test', full_name: 'منى من الجذر' },
      { id: 5, email: 'disabled@example.test', full_name: 'معطل', disabled_at: db.fn.now() },
      { id: 6, email: 'child@example.test', full_name: 'علي من الوحدة الفرعية' },
    ])
    await db('user_org_units').insert([
      { user_id: 1, org_unit_id: 1 },
      { user_id: 2, org_unit_id: 2 },
      { user_id: 3, org_unit_id: 3 },
      { user_id: 4, org_unit_id: 1 },
      { user_id: 5, org_unit_id: 2 },
      { user_id: 6, org_unit_id: 4 },
    ])
    await createResourceTable(db, ticket)
  })

  test('only active members of the record unit or its ancestors can be chosen', async ({
    assert,
  }) => {
    const saved = await service().save('tickets', agent, {
      title: 'عطل الطابعة',
      assignee: 2,
      orgUnitId: 2,
    })
    assert.equal(saved.assignee, 2)
    const ancestor = await service().save('tickets', agent, {
      title: 'تحديث النظام',
      assignee: 4,
      orgUnitId: 2,
    })
    assert.equal(ancestor.assignee, 4)
    // A sibling unit, a disabled account and a child unit cannot see unit A's records.
    for (const assignee of [3, 5, 6, 999]) {
      const error = await failure(() =>
        service().save('tickets', agent, { title: 'مرفوض', assignee, orgUnitId: 2 })
      )
      assert.equal(error.code, 'E_USER_FIELD', `user ${assignee}`)
    }
    const typed = await failure(() =>
      service().save('tickets', agent, { title: 'نص', assignee: 'سارة', orgUnitId: 2 })
    )
    assert.equal(typed.code, 'E_FIELD_VALUE')
    // Keeping a value that has since become ineligible does not block other edits.
    await db('users').where('id', 4).update({ disabled_at: db.fn.now() })
    try {
      const kept = await service().save(
        'tickets',
        agent,
        { title: 'تحديث النظام (معدل)', assignee: 4, orgUnitId: 2 },
        Number(ancestor.id)
      )
      assert.equal(kept.title, 'تحديث النظام (معدل)')
    } finally {
      await db('users').where('id', 4).update({ disabled_at: null })
    }
  })

  test('lists and details carry names only; filters and conditions use the user id', async ({
    assert,
  }) => {
    const page = await service().list('tickets', agent, { filters: { assignee: 2 } })
    assert.isAbove(page.data.length, 0)
    assert.isTrue(page.data.every((row) => row.assignee === 2))
    assert.deepEqual(page.related.assignee, [{ id: 2, fullName: 'سارة الوكيلة' }])
    assert.notInclude(JSON.stringify(page), 'example.test')
    const sorted = await service().list('tickets', agent, { sort: 'assignee', direction: 'desc' })
    assert.equal(sorted.data[0].assignee, 4)
    const shown = await service().show('tickets', Number(page.data[0].id), agent)
    assert.equal(shown.related.assignee[0].fullName, 'سارة الوكيلة')
    assert.deepEqual(conditionSql({ assignee: 2 }, ticket).bindings, ['r.assignee', 2])
    assert.throws(() => conditionSql({ assignee: 'سارة' }, ticket), /expected number/)
    const described = service().describe('tickets', agent)
    assert.equal(described.fields.find((field) => field.key === 'assignee')?.type, 'user')
  })

  test('form and filter choices follow organization scope and search by name', async ({
    assert,
  }) => {
    const form = await service().relationOptions('tickets', 'assignee', agent, { orgUnitId: 2 })
    assert.deepEqual(
      form.data.map((option) => option.value),
      ['1', '2', '4']
    )
    assert.equal(form.data[1].label, 'سارة الوكيلة')
    const searched = await service().relationOptions('tickets', 'assignee', agent, {
      orgUnitId: 2,
      search: 'منى',
    })
    assert.deepEqual(
      searched.data.map((option) => option.value),
      ['4']
    )
    // A unit outside the actor's scope reveals nobody.
    const foreign = await service().relationOptions('tickets', 'assignee', agent, { orgUnitId: 3 })
    assert.lengthOf(foreign.data, 0)
    const filter = await service().relationOptions('tickets', 'assignee', agent, {
      purpose: 'filter',
    })
    assert.deepEqual(
      filter.data.map((option) => option.value),
      ['1', '2', '4', '6']
    )
    const editor = await service().editor('tickets', agent)
    assert.isTrue(editor.relationSearch.assignee)
    const [existing] = await db('tickets').where('assignee', 2).limit(1)
    const edit = await service().editor('tickets', agent, Number(existing.id))
    assert.deepEqual(edit.options.assignee, [{ value: '2', label: 'سارة الوكيلة' }])
    const outsider: Actor = { ...agent, id: 3, rules: [{ subject: 'tickets', action: 'view' }] }
    const denied = await failure(() =>
      service().relationOptions('tickets', 'assignee', outsider, { orgUnitId: 2 })
    )
    assert.equal(denied.status, 403)
  })
})
