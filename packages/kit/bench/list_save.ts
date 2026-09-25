// Diagnostic benchmark (not an acceptance measurement): ResourceService list/save
// latency in-process against PostgreSQL with 100000 rows and N concurrent callers.
import knex from 'knex'
import { BaseModel } from '@adonisjs/lucid/orm'
import {
  ResourceRegistry,
  ResourceService,
  createCoreSchema,
  createResourceTable,
  createCollaborationSchema,
  createAssignmentsSchema,
  createMessagingSchema,
  createAttachmentsSchema,
  defineResource,
} from '../index.js'
import type { Actor, RecordData } from '../index.js'

const db = knex({
  client: 'pg',
  connection: process.env.TEST_DATABASE_URL,
  pool: { min: 0, max: Number(process.env.POOL ?? 20) },
  searchPath: ['bench', 'public'],
})
const passthrough = { validate: async (data: unknown) => data as RecordData }
const category = defineResource({
  name: 'categories',
  label: { ar: 'الفئات', en: 'Categories' },
  model: BaseModel,
  scoped: false,
  fields: {
    name: { type: 'string', required: true, label: { ar: 'الاسم', en: 'Name' }, searchable: true },
  },
  list: ['name'],
  form: ['name'],
  show: ['name'],
  actions: ['view', 'create', 'update', 'delete'],
  validator: passthrough,
})
const location = defineResource({
  name: 'locations',
  label: { ar: 'المواقع', en: 'Locations' },
  model: BaseModel,
  scoped: false,
  fields: {
    name: { type: 'string', required: true, label: { ar: 'الاسم', en: 'Name' }, searchable: true },
  },
  list: ['name'],
  form: ['name'],
  show: ['name'],
  actions: ['view', 'create', 'update', 'delete'],
  validator: passthrough,
})
const asset = defineResource({
  name: 'assets',
  label: { ar: 'الأصول', en: 'Assets' },
  model: BaseModel,
  scoped: true,
  version: true,
  fields: {
    tag: {
      type: 'string',
      required: true,
      unique: true,
      label: { ar: 'الرمز', en: 'Tag' },
      searchable: true,
      sortable: true,
    },
    categoryId: {
      type: 'belongsTo',
      resource: 'categories',
      required: true,
      label: { ar: 'الفئة', en: 'Category' },
    },
    locationId: {
      type: 'belongsTo',
      resource: 'locations',
      required: true,
      label: { ar: 'الموقع', en: 'Location' },
    },
    notes: { type: 'text', label: { ar: 'ملاحظات', en: 'Notes' } },
  },
  list: ['tag', 'categoryId', 'locationId'],
  form: ['tag', 'categoryId', 'locationId', 'notes'],
  show: ['tag', 'categoryId', 'locationId', 'notes'],
  actions: ['view', 'create', 'update', 'delete'],
  validator: passthrough,
})
const registry = new ResourceRegistry().register([
  { name: 'catalog', label: { ar: 'x', en: 'x' }, dependsOn: [], resources: [category, location] },
  { name: 'assets', label: { ar: 'x', en: 'x' }, dependsOn: ['catalog'], resources: [asset] },
])
const actor: Actor = {
  id: 1,
  orgPaths: ['1'],
  permissionLevel: 0,
  rules: [{ subject: 'all', action: 'manage' }],
}

async function setup() {
  await db.raw('DROP SCHEMA IF EXISTS bench CASCADE')
  await db.raw('CREATE SCHEMA bench')
  await db.schema.createTable('users', (t) => {
    t.increments('id')
    t.string('email')
    t.string('full_name')
    t.timestamp('disabled_at')
  })
  await db('users').insert({ id: 1, email: 'b@example.test' })
  await createCoreSchema(db)
  await createAttachmentsSchema(db)
  await createCollaborationSchema(db)
  await createAssignmentsSchema(db)
  await createMessagingSchema(db)
  await db('org_units').insert([
    { id: 1, name: 'root', type: 'root', path: '1' },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: i + 2,
      parent_id: 1,
      name: `u${i}`,
      type: 'unit',
      path: `1.${i + 2}`,
    })),
  ])
  for (const resource of registry.all()) await createResourceTable(db, resource)
  await db('categories').insert(
    Array.from({ length: 10 }, (_, i) => ({ name: `فئة ${i}`, created_by: 1, updated_by: 1 }))
  )
  await db('locations').insert(
    Array.from({ length: 50 }, (_, i) => ({ name: `موقع ${i}`, created_by: 1, updated_by: 1 }))
  )
  await db.raw(`INSERT INTO assets (tag, category_id, location_id, notes, org_unit_id, created_by, updated_by)
    SELECT 'A-' || g, 1 + (g % 10), 1 + (g % 50), 'ملاحظة ' || g, CASE WHEN g % 2 = 0 THEN 2 ELSE 3 + (g % 9) END, 1, 1
    FROM generate_series(1, 100000) g`)
  await db.raw('ANALYZE')
}

function p95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.95)]
}

async function run(
  label: string,
  concurrency: number,
  iterations: number,
  work: (i: number) => Promise<unknown>
) {
  const times: number[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < iterations) {
        const i = next++
        const start = performance.now()
        await work(i)
        times.push(performance.now() - start)
      }
    })
  )
  console.log(
    `${label}: n=${times.length} concurrency=${concurrency} p50=${p95(
      times
        .map((t) => t)
        .sort((a, b) => a - b)
        .slice(0, Math.ceil((times.length / 2) * 1.9))
    ).toFixed(1)} p95=${p95(times).toFixed(1)} ms`
  )
}

if (process.env.SETUP !== '0') await setup()
const service = new ResourceService(db, registry)
const concurrency = Number(process.env.CONCURRENCY ?? 50)
await run('list(first page, estimate)', concurrency, 1000, () =>
  service.list('assets', actor, { limit: 50 })
)
await run('list(no estimate)', concurrency, 1000, () =>
  service.list('assets', actor, { limit: 50, estimate: false })
)
let counter = 0
await run('create', concurrency, 1000, () =>
  service.save('assets', actor, {
    tag: `N-${counter++}-${Date.now()}`,
    categoryId: 1,
    locationId: 2,
    orgUnitId: 2,
  })
)
await db.destroy()
