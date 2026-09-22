import { test } from '@japa/runner'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import router from '@adonisjs/core/services/router'

test.group('Reference HTTP roundtrip and route inventory', (group) => {
  let admin: User
  let restricted: User
  let orgId: number
  group.setup(async () => {
    admin = await User.create({
      fullName: 'مدير الاختبار',
      email: 'roundtrip@example.test',
      password: 'test-only-password-123',
    })
    restricted = await User.create({
      fullName: 'بلا صلاحيات',
      email: 'restricted@example.test',
      password: 'test-only-password-123',
    })
    const knex = db.connection().getWriteClient()
    const [org] = await knex('org_units')
      .insert({ name: 'الجهة', type: 'root', path: '999' })
      .returning('id')
    orgId = org.id
    const [role] = await knex('roles')
      .insert({ name: 'roundtrip-admin', permission_level: 1 })
      .returning('id')
    await knex('role_rules').insert({ role_id: role.id, subject: 'all', action: 'manage' })
    await knex('user_roles').insert({ user_id: admin.id, role_id: role.id })
    await knex('user_org_units').insert({ user_id: admin.id, org_unit_id: org.id })
  })
  test('registered route scan denies every resource handler without roles', async ({
    client,
    assert,
  }) => {
    const routes = Object.values(router.toJSON())
      .flat()
      .filter((route) => route.pattern.startsWith('/resources/'))
    assert.isAtLeast(routes.length, 7)
    for (const route of routes) {
      for (const verb of route.methods.filter((method) => method !== 'HEAD')) {
        const url = route.pattern.replace(':resource', 'orders').replace(':id', '999999')
        const method = verb.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
        const response = await client[method](url)
          .loginAs(restricted)
          .withCsrfToken()
          .header('Accept', 'application/json')
        response.assertStatus(403)
      }
    }
  })
  test('JSON create, field contract, optimistic update and lifecycle', async ({
    client,
    assert,
  }) => {
    const created = await client
      .post('/resources/orders')
      .loginAs(admin)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ orgUnitId: orgId, notes: 'طلب اختبار متكامل', total: '4500' })
    created.assertStatus(201)
    const record = created.body().data
    assert.equal(record.version, 1)
    assert.notProperty(record, 'createdBy')
    assert.notProperty(record, 'orgPath')
    const updated = await client
      .patch(`/resources/orders/${record.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ notes: 'محدّث', version: 1 })
    updated.assertStatus(200)
    assert.equal(updated.body().data.version, 2)
    const stale = await client
      .patch(`/resources/orders/${record.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ notes: 'قديم', version: 1 })
    stale.assertStatus(409)
    const bad = await client
      .patch(`/resources/orders/${record.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ createdBy: 500, version: 2 })
    bad.assertStatus(422)
    const submitted = await client
      .post(`/resources/orders/${record.id}/submit`)
      .loginAs(admin)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ version: 2 })
    submitted.assertStatus(200)
    assert.equal(submitted.body().data.docStatus, 1)
    const knex = db.connection().getWriteClient()
    assert.exists(await knex('outbox').where('event', 'orders.orders.submitted').first())
    const [role] = await knex('roles').insert({ name: 'outside-reader' }).returning('id')
    await knex('role_rules').insert({ role_id: role.id, subject: 'orders', action: 'view' })
    await knex('user_roles').insert({ user_id: restricted.id, role_id: role.id })
    const outside = await client
      .get(`/resources/orders/${record.id}`)
      .loginAs(restricted)
      .header('Accept', 'application/json')
    outside.assertStatus(404)
  })
})
