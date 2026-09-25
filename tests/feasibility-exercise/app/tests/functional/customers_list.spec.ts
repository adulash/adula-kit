import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { inputErrors, makeCustomer, makeWorld } from '#tests/helpers'

test.group('Customers | search, sort and pagination', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function seed() {
    const world = await makeWorld()
    await makeCustomer(world.unitA, {
      name: 'بيت الخبرة',
      email: 'hello@house.example',
      phone: '0500000001',
      createdAt: DateTime.fromISO('2026-01-03T00:00:00Z'),
    })
    await makeCustomer(world.unitA, {
      name: 'أفق التقنية',
      email: null,
      phone: '0500000002',
      createdAt: DateTime.fromISO('2026-01-01T00:00:00Z'),
    })
    await makeCustomer(world.unitA, {
      name: 'تاج 100% للتجارة',
      email: 'sales@taj.example',
      phone: null,
      createdAt: DateTime.fromISO('2026-01-02T00:00:00Z'),
    })
    return world
  }

  const names = (response: any) => response.inertiaProps.customers.data.map((c: any) => c.name)

  test('lists own unit customers sorted by name by default', async ({ client, assert }) => {
    const { managerA } = await seed()
    const response = await client.get('/customers').loginAs(managerA).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('customers/index')
    assert.deepEqual(names(response), ['أفق التقنية', 'بيت الخبرة', 'تاج 100% للتجارة'])
    assert.deepEqual(response.inertiaProps.filters, { search: '', sort: 'name', order: 'asc' })
    assert.isTrue(response.inertiaProps.can.create)
  })

  test('sorts by name descending and by creation date', async ({ client, assert }) => {
    const { managerA } = await seed()

    const desc = await client
      .get('/customers')
      .qs({ sort: 'name', order: 'desc' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(desc), ['تاج 100% للتجارة', 'بيت الخبرة', 'أفق التقنية'])

    const byDate = await client
      .get('/customers')
      .qs({ sort: 'created_at', order: 'asc' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(byDate), ['أفق التقنية', 'تاج 100% للتجارة', 'بيت الخبرة'])
  })

  test('rejects unknown sort columns', async ({ client, assert }) => {
    const { managerA } = await seed()
    const response = await client
      .get('/customers')
      .qs({ sort: 'password' })
      .loginAs(managerA)
      .withInertia()
      .redirects(0)
    response.assertStatus(302)
    assert.deepEqual(inputErrors(response).sort, ['قيمة sort غير مسموحة'])
  })

  test('searches name, email and phone case-insensitively', async ({ client, assert }) => {
    const { managerA } = await seed()

    const byName = await client
      .get('/customers')
      .qs({ search: 'الخبرة' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(byName), ['بيت الخبرة'])

    const byEmail = await client
      .get('/customers')
      .qs({ search: 'SALES@' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(byEmail), ['تاج 100% للتجارة'])

    const byPhone = await client
      .get('/customers')
      .qs({ search: '0000002' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(byPhone), ['أفق التقنية'])
  })

  test('treats LIKE wildcards in the search literally', async ({ client, assert }) => {
    const { managerA } = await seed()
    const percent = await client
      .get('/customers')
      .qs({ search: '%' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(percent), ['تاج 100% للتجارة'])

    const underscore = await client
      .get('/customers')
      .qs({ search: '_' })
      .loginAs(managerA)
      .withInertia()
    assert.deepEqual(names(underscore), [])
  })

  test('paginates 20 per page', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    for (let i = 1; i <= 25; i++) {
      await makeCustomer(unitA, { name: `عميل ${String(i).padStart(2, '0')}` })
    }
    const page2 = await client.get('/customers').qs({ page: 2 }).loginAs(managerA).withInertia()
    assert.lengthOf(page2.inertiaProps.customers.data, 5)
    assert.equal(page2.inertiaProps.customers.metadata.total, 25)
    assert.equal(page2.inertiaProps.customers.metadata.currentPage, 2)
  })
})
