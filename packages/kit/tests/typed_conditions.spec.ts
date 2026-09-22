import { test } from '@japa/runner'
import { subject } from '@casl/ability'
import {
  defineResource,
  createResourceTable,
  buildAbility,
  accessibleBy,
  ResourceRegistry,
  ResourceService,
} from '../index.js'
import { fromRow } from '../src/admin/contracts.js'
import type { Conditions } from '../src/auth/conditions.js'
import { db, setup, order, admin } from './helpers.js'

const resource = defineResource({
  name: 'typed_records',
  label: { ar: 'عقد الأنواع', en: 'Typed contract' },
  model: order.model,
  scoped: false,
  fields: {
    amount: { type: 'money', label: { ar: 'مبلغ', en: 'Amount' } },
    day: { type: 'date', label: { ar: 'تاريخ', en: 'Day' } },
    instant: { type: 'datetime', label: { ar: 'وقت', en: 'Instant' } },
    text: { type: 'string', label: { ar: 'نص', en: 'Text' } },
    memo: { type: 'text', label: { ar: 'تفاصيل', en: 'Memo' } },
    quantity: { type: 'integer', label: { ar: 'عدد', en: 'Quantity' } },
    enabled: { type: 'boolean', label: { ar: 'مفعل', en: 'Enabled' } },
    details: { type: 'json', label: { ar: 'بيانات', en: 'Details' } },
    attachment: { type: 'attachment', label: { ar: 'مرفق', en: 'Attachment' } },
  },
  list: ['amount', 'day', 'instant', 'text'],
  form: [
    'amount',
    'day',
    'instant',
    'text',
    'memo',
    'quantity',
    'enabled',
    'details',
    'attachment',
  ],
  show: [
    'amount',
    'day',
    'instant',
    'text',
    'memo',
    'quantity',
    'enabled',
    'details',
    'attachment',
  ],
  actions: ['view', 'create'],
  validator: { validate: async (value) => value as Record<string, unknown> },
})
const cases: [string, Conditions][] = [
  ['money greater than nine', { amount: { $gt: '9' } }],
  ['money below negative nine', { amount: { $lt: '-9' } }],
  ['money above safe integer range', { amount: { $gt: '9007199254740992' } }],
  ['date equality', { day: '2026-09-17' }],
  ['date order', { day: { $lt: '2026-09-17' } }],
  ['date membership and null', { day: { $in: ['2026-09-17', null] } }],
  ['UTC timestamp order', { instant: { $gt: '2026-09-17T00:00:00.000Z' } }],
  ['UTC timestamp inequality', { instant: { $ne: '2026-09-17T00:00:00.000Z' } }],
  ['numeric text stays lexical', { text: { $gt: '9' } }],
  ['Unicode text uses code-point order', { text: { $lt: '😀' } }],
]
test.group('Schema-aware SQL and CASL parity', (group) => {
  group.setup(async () => {
    await setup()
    await createResourceTable(db, resource)
    await db(resource.name).insert([
      {
        id: 1,
        amount: '10',
        day: '2026-09-17',
        instant: '2026-09-17T00:00:00.000Z',
        text: '10',
        created_by: 1,
        updated_by: 1,
      },
      {
        id: 2,
        amount: '-10',
        day: '2026-09-16',
        instant: '2026-09-17T01:00:00.000Z',
        text: '\uE000',
        created_by: 1,
        updated_by: 1,
      },
      {
        id: 3,
        amount: '9007199254740993',
        day: '2026-09-18',
        instant: '2026-09-16T23:59:59.000Z',
        text: '😀',
        created_by: 1,
        updated_by: 1,
      },
      { id: 4, amount: null, day: null, instant: null, text: null, created_by: 1, updated_by: 1 },
    ])
    await db.raw("SELECT setval(pg_get_serial_sequence(?, 'id'), 4)", [resource.name])
  })
  for (const [label, conditions] of cases)
    test(label, async ({ assert }) => {
      const ability = buildAbility(
        [{ action: 'view', subject: resource.name, conditions }],
        [resource]
      )
      const sql = await accessibleBy(db(`${resource.name} as r`), ability, admin, 'view', resource)
        .select('r.id')
        .orderBy('r.id')
      const rows = await db(resource.name).orderBy('id')
      const memory = rows
        .filter((row) => ability.can('view', subject(resource.name, fromRow(row, resource))))
        .map((row) => row.id)
      assert.deepEqual(
        sql.map((row: { id: number }) => row.id),
        memory
      )
    })
  test('typed rules reject malformed dates and money rules without schemas before SQL', ({
    assert,
  }) => {
    const malformed: Conditions[] = [
      { day: '2026-02-30' },
      { instant: '2026-09-17T00:00:00+00:00' },
    ]
    for (const conditions of malformed) {
      const ability = buildAbility(
        [{ action: 'view', subject: resource.name, conditions }],
        [resource]
      )
      assert.throws(
        () => accessibleBy(db(`${resource.name} as r`), ability, admin, 'view', resource),
        /Date conditions/
      )
    }
    const untyped = buildAbility([
      { action: 'view', subject: resource.name, conditions: { amount: { $gt: '9' } } },
    ])
    assert.throws(
      () => accessibleBy(db(`${resource.name} as r`), untyped, admin, 'view', resource),
      /resourceSchemas/
    )
  })
  const registry = new ResourceRegistry().register([
    { name: 'typed', label: { ar: 'أنواع', en: 'Types' }, dependsOn: [], resources: [resource] },
  ])
  const service = new ResourceService(db, registry)
  test('stored scalar and JSON field contracts roundtrip without precision or timezone loss', async ({
    assert,
  }) => {
    const record = await service.save(resource.name, admin, {
      amount: '9223372036854775807',
      day: '2026-09-18',
      instant: '2026-09-18T00:30:00.000Z',
      text: 'عربي',
      memo: 'نص طويل\nسطر آخر',
      quantity: 2147483647,
      enabled: false,
      details: { nested: [true, null, 'عربي', 42] },
    })
    const shown = await service.show(resource.name, Number(record.id), admin)
    assert.equal(shown.data.amount, '9223372036854775807')
    assert.equal(shown.data.day, '2026-09-18')
    assert.equal(shown.data.instant, '2026-09-18T00:30:00.000Z')
    assert.strictEqual(shown.data.enabled, false)
    assert.strictEqual(shown.data.quantity, 2147483647)
    assert.deepEqual(shown.data.details, { nested: [true, null, 'عربي', 42] })
    assert.equal(shown.data.memo, 'نص طويل\nسطر آخر')
  })
  test('money predicates evaluate the stored form of safe numeric inputs', async ({ assert }) => {
    const actor = {
      ...admin,
      rules: [
        { action: ['create', 'view'], subject: resource.name },
        {
          action: 'create',
          subject: resource.name,
          inverted: true,
          conditions: { amount: { $gt: '9' } },
        },
      ],
    }
    await assert.rejects(() => service.save(resource.name, actor, { amount: 10 }), /صلاحية/)
    const saved = await service.save(resource.name, actor, { amount: 9 })
    assert.strictEqual(saved.amount, '9')
  })
  test('invalid field representations fail before database coercion or lossy JSON serialization', async ({
    assert,
  }) => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    for (const input of [
      { amount: '01' },
      { amount: '-0' },
      { amount: '9223372036854775808' },
      { amount: 9007199254740992 },
      { day: '2026-02-30' },
      { instant: '2026-09-18T03:00:00+03:00' },
      { quantity: 2147483648 },
      { quantity: '5' },
      { enabled: 'false' },
      { details: { missing: undefined } },
      { details: cycle },
    ])
      await assert.rejects(
        () => service.save(resource.name, admin, input),
        /minor units|ISO date|integer|boolean|JSON/
      )
    await assert.rejects(
      () => service.save(resource.name, admin, { attachment: 'someone-elses-file' }),
      /uploaded attachment/
    )
  })
})
