import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { medicalFixture } from '#tests/medical/fixture'

test.group('Medical-assets transaction and relation boundaries', (group) => {
  let user: User
  let orgUnitId: number
  let foreignLocationId: number
  let roleId: number
  const knex = () => db.connection().getWriteClient()
  group.setup(async () => {
    const suffix = randomUUID().replaceAll('-', '_')
    user = await User.create({ fullName: 'فني الاختبار', email: `${suffix}@example.test`, password: 'medical-test-password-1234' })
    const [org, other] = await knex()('org_units').insert([
      { name: 'قسم الاختبار', type: 'root', path: `medical_${suffix}` },
      { name: 'قسم مستقل', type: 'root', path: `outside_${suffix}` },
    ]).returning('id')
    orgUnitId = org.id
    const [role] = await knex()('roles').insert({ name: `medical_${suffix}`, permission_level: 1 }).returning('id')
    roleId = role.id
    for (const subject of ['medical_assets', 'equipment_categories', 'equipment_locations', 'asset_components'])
      await knex()('role_rules').insert({ role_id: role.id, subject, action: 'manage' })
    await knex()('user_roles').insert({ user_id: user.id, role_id: role.id })
    await knex()('user_org_units').insert({ user_id: user.id, org_unit_id: orgUnitId })
    const [location] = await knex()('equipment_locations').insert({ name: 'موقع محجوب', org_unit_id: other.id, created_by: user.id, updated_by: user.id }).returning('id')
    foreignLocationId = location.id
  })
  const fixture = () => medicalFixture('medical_assets', { userId: user.id, orgUnitId, unique: randomUUID() })
  test('a denied component rolls back the parent, audit and outbox', async ({ client, assert }) => {
    const values = await fixture()
    const counts = async () => Promise.all(['medical_assets', 'asset_components', 'activities', 'outbox'].map(async (table) => {
      const row = await knex()(table).count('* as total').first()
      return Number(row!.total)
    }))
    const [deny] = await knex()('role_rules').insert({ role_id: roleId, subject: 'asset_components', action: 'create', inverted: true, conditions: JSON.stringify({ name: { $eq: 'مكوّن محظور' } }) }).returning('id')
    try {
      const before = await counts()
      const result = await client.post('/resources/medical_assets').loginAs(user).withCsrfToken().header('Accept', 'application/json').json({
        ...values.input, orgUnitId, components: [{ name: 'مكوّن محظور', quantity: 1 }],
      })
      result.assertStatus(403)
      assert.deepEqual(await counts(), before)
    } finally { await knex()('role_rules').where('id', deny.id).delete() }
  })
  test('a readable resource cannot link to an out-of-scope location', async ({ client, assert }) => {
    const values = await fixture()
    const result = await client.post('/resources/medical_assets').loginAs(user).withCsrfToken().header('Accept', 'application/json').json({ ...values.input, orgUnitId, locationId: foreignLocationId })
    result.assertStatus(404)
    const name = values.input.name
    if (typeof name !== 'string') throw new Error('Medical fixture requires an asset name')
    assert.isUndefined(await knex()('medical_assets').where('name', name).first())
  })
  test('stale parent updates preserve the existing children and the current description', async ({ client, assert }) => {
    const values = await fixture()
    const created = await client.post('/resources/medical_assets').loginAs(user).withCsrfToken().header('Accept', 'application/json').json({ ...values.input, orgUnitId })
    created.assertStatus(201)
    const row = created.body().data
    const updated = await client.patch(`/resources/medical_assets/${row.id}`).loginAs(user).withCsrfToken().header('Accept', 'application/json').json({ ...values.update, description: 'التحديث الصحيح', version: row.version })
    updated.assertStatus(200)
    const before = await knex()('asset_components').where('asset_id', row.id).orderBy('id')
    const stale = await client.patch(`/resources/medical_assets/${row.id}`).loginAs(user).withCsrfToken().header('Accept', 'application/json').json({ ...values.input, description: 'تحديث قديم', version: row.version })
    stale.assertStatus(409)
    assert.deepEqual(await knex()('asset_components').where('asset_id', row.id).orderBy('id'), before)
    const persisted = await knex()('medical_assets').where('id', row.id).first()
    assert.equal(persisted.description, 'التحديث الصحيح')
  })
})
