import { BaseCommand } from '@adonisjs/core/ace'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

export default class MedicalSeed extends BaseCommand {
  static commandName = 'medical:seed'
  static description = 'Seed the isolated medical-assets acceptance consumer and measure cached authorization'
  static options = { startApp: true }

  async run() {
    const { default: env } = await import('#start/env')
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { default: User } = await import('#models/user')
    const { kit } = await import('#services/kit')
    const { buildAbility } = await import('@adula/kit')
    if (!/^adula_medical_\d+_test$/.test(env.get('DB_DATABASE')))
      throw new Error('Seed only a fresh isolated medical consumer *_test database')
    const knex = db.connection().getWriteClient()
    const existing = await knex('medical_assets').count('* as count').first()
    if (Number(existing?.count))
      throw new Error('Medical seed refuses a populated asset table')
    const owner = await User.findByOrFail('email', 'owner@example.test')
    const root = await knex('org_units').whereNull('parent_id').first()
    const audit = { created_by: owner.id, updated_by: owner.id }
    const password = randomBytes(24).toString('base64url')
    const users: { email: string; password: string; saveBody: Record<string, unknown>; id: number }[] = []
    const organizations: { id: number; path: string }[] = []
    const categories: { id: number }[] = []
    const locations: { id: number; org_unit_id: number }[] = []
    const [role] = await knex('roles').insert({ name: 'medical-load-users', permission_level: 1 }).returning('id')
    for (const subject of ['medical_assets', 'equipment_categories', 'equipment_locations', 'asset_components'])
      for (const action of ['view', 'create', 'update', 'delete'])
        await knex('role_rules').insert({ role_id: role.id, subject, action })
    for (let i = 0; i < 10; i++) {
      const [org] = await knex('org_units').insert({ name: `قسم الأجهزة ${i + 1}`, type: 'department', parent_id: root.id, path: `${root.path}.medical_${i}` }).returning(['id', 'path'])
      organizations.push(org)
      const [category] = await knex('equipment_categories').insert({ name: `فئة الأجهزة ${i + 1}`, ...audit }).returning('id')
      categories.push(category)
      for (let room = 0; room < 5; room++) {
        const [location] = await knex('equipment_locations').insert({ name: `غرفة ${i + 1}-${room + 1}`, org_unit_id: org.id, ...audit }).returning(['id', 'org_unit_id'])
        locations.push(location)
      }
    }
    for (let i = 0; i < 50; i++) {
      const unit = organizations[i % 10]
      const user = await User.create({ fullName: `فني أجهزة ${i + 1}`, email: `medical-load-${i + 1}@example.test`, password })
      await knex('user_roles').insert({ user_id: user.id, role_id: role.id })
      await knex('user_org_units').insert({ user_id: user.id, org_unit_id: unit.id })
      users.push({ id: user.id, email: user.email, password, saveBody: {
        orgUnitId: unit.id, description: 'جهاز قياس الأداء', categoryId: categories[i % 10].id,
        locationId: locations[(i % 10) * 5 + Math.floor(i / 10)].id,
        acquisitionCost: '125000', acquiredAt: '2026-09-22', manual: null,
        components: [{ name: 'مجس الجهاز', quantity: 1 }],
      } })
    }
    // Synthetic performance data only. Batch inserts preserve real schema/FKs/indexes;
    // HTTP suites separately verify business transactions, outbox and authorization.
    await knex.transaction(async (trx) => {
      for (let start = 0; start < 100000; start += 1000) {
        const rows = Array.from({ length: 1000 }, (_, offset) => {
          const i = start + offset
          const unit = i < 50000 ? 0 : 1 + (i % 9)
          return {
            name: `MED-${String(i + 1).padStart(6, '0')}`, description: `جهاز طبي ${i % 20 + 1}`,
            category_id: categories[i % 10].id, location_id: locations[unit * 5 + (Math.floor(i / 10) % 5)].id,
            org_unit_id: organizations[unit].id, acquisition_cost: String(10000 + i * 17),
            acquired_at: `202${i % 6}-0${i % 9 + 1}-15`, ...audit,
          }
        })
        await trx('medical_assets').insert(rows)
      }
    })
    await knex.raw('ANALYZE medical_assets')
    await knex.raw('ANALYZE equipment_locations')
    const counts = await knex('medical_assets').select('org_unit_id').count('* as count').groupBy('org_unit_id').orderBy('org_unit_id')
    if (counts.reduce((sum, row) => sum + Number(row.count), 0) !== 100000) throw new Error('Incorrect seed count')

    const runtime = kit()
    for (const user of users) await runtime.actors.load(user.id)
    const queries: string[] = []
    const onQuery = (query: { sql: string }) => queries.push(query.sql)
    const samples: { loadMs: number; buildMs: number; totalMs: number }[] = []
    knex.on('query', onQuery)
    try {
      for (let i = 0; i < 500; i++) {
        const start = performance.now()
        const actor = await runtime.actors.load(users[i % 50].id)
        const loaded = performance.now()
        const ability = buildAbility(actor.rules, runtime.registry.all())
        const ended = performance.now()
        if (!ability.can('view', 'medical_assets')) throw new Error('Measured user is not authorized')
        samples.push({ loadMs: loaded - start, buildMs: ended - loaded, totalMs: ended - start })
      }
    } finally { knex.off('query', onQuery) }
    if (queries.length !== 500 || queries.some((sql) => !sql.includes('authorization_revision')))
      throw new Error('Warm cache did not reduce reads to the authorization revision check')
    const [deny] = await knex('role_rules').insert({ role_id: role.id, subject: 'medical_assets', action: 'view', inverted: true }).returning('id')
    try {
      const actor = await runtime.actors.load(users[0].id)
      if (buildAbility(actor.rules, runtime.registry.all()).can('view', 'medical_assets'))
        throw new Error('Authorization revision failed to invalidate cached permissions')
    } finally { await knex('role_rules').where('id', deny.id).delete() }
    const percentile = (key: 'loadMs' | 'buildMs' | 'totalMs') => samples.map((sample) => sample[key]).sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]
    const benchmark = {
      measuredAt: new Date().toISOString(), environment: 'local independent consumer; not staging',
      sampleCount: samples.length, users: users.length, warmupLoads: users.length,
      timingBoundary: 'ActorStore.load including PostgreSQL revision read and actual L1/L2 adapter, followed by buildAbility',
      p95: { loadMs: percentile('loadMs'), buildMs: percentile('buildMs'), totalMs: percentile('totalMs') },
      cacheQueries: queries.length, invalidationVerified: true, samples,
    }
    await writeFile(this.app.tmpPath('ability-benchmark.json'), JSON.stringify(benchmark, null, 2))
    await writeFile(this.app.tmpPath('medical-seed.json'), JSON.stringify({ rows: 100000, users: users.length, counts, organizations, categories, locations }, null, 2))
    await writeFile(this.app.tmpPath('performance-fixture.json'), JSON.stringify({
      baseUrl: env.get('APP_URL'), isolated: true, resource: 'medical_assets', uniqueField: 'name',
      runId: `medical-${Date.now()}`, relationFields: ['categoryId', 'locationId'], users,
    }, null, 2), { mode: 0o600 })
    this.logger.success('Seeded 100000 assets and 50 authorized users; private performance fixture and measured cache report are in tmp/')
    if (benchmark.p95.totalMs >= 5) this.logger.warning('Local cached actor/Ability p95 exceeds 5ms; acceptance remains pending')
  }
}
