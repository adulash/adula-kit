import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Customer from '#models/customer'
import { makeCustomer, makeUser, makeWorld } from '#tests/helpers'

test.group('Customers | authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('employee sees only the customers of their own unit', async ({ client, assert }) => {
    const { employeeA, unitA, unitB } = await makeWorld()
    await makeCustomer(unitA, { name: 'عميل أ' })
    await makeCustomer(unitB, { name: 'عميل ب' })

    const response = await client.get('/customers').loginAs(employeeA).withInertia()
    response.assertStatus(200)
    assert.deepEqual(
      response.inertiaProps.customers.data.map((c: any) => c.name),
      ['عميل أ']
    )
    assert.isFalse(response.inertiaProps.can.create)
  })

  test('search cannot reach customers of another unit', async ({ client, assert }) => {
    const { employeeA, unitB } = await makeWorld()
    await makeCustomer(unitB, { name: 'سري جداً' })

    const response = await client
      .get('/customers')
      .qs({ search: 'سري' })
      .loginAs(employeeA)
      .withInertia()
    assert.lengthOf(response.inertiaProps.customers.data, 0)
  })

  test('employee can open own unit customer read-only', async ({ client, assert }) => {
    const { employeeA, unitA } = await makeWorld()
    const customer = await makeCustomer(unitA)

    const response = await client.get(`/customers/${customer.id}`).loginAs(employeeA).withInertia()
    response.assertStatus(200)
    assert.deepEqual(response.inertiaProps.can, { update: false, delete: false })
  })

  test('customers of another unit are not found for employees and managers', async ({ client }) => {
    const { employeeA, managerA, unitB } = await makeWorld()
    const foreign = await makeCustomer(unitB)

    for (const user of [employeeA, managerA]) {
      const show = await client.get(`/customers/${foreign.id}`).loginAs(user).withInertia()
      show.assertStatus(404)
      const edit = await client.get(`/customers/${foreign.id}/edit`).loginAs(user).withInertia()
      edit.assertStatus(404)
    }
  })

  test('manager of another unit cannot update or delete', async ({ client, assert }) => {
    const { managerB, unitA } = await makeWorld()
    const customer = await makeCustomer(unitA, { name: 'محمي' })

    const update = await client
      .put(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(managerB)
      .withInertia()
      .form({ name: 'مخترق' })
    update.assertStatus(404)

    const destroy = await client
      .delete(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(managerB)
      .withInertia()
    destroy.assertStatus(404)

    await customer.refresh()
    assert.equal(customer.name, 'محمي')
    assert.isNull(customer.deletedAt)
  })

  test('employee cannot create, edit or delete', async ({ client, assert }) => {
    const { employeeA, unitA } = await makeWorld()
    const customer = await makeCustomer(unitA, { name: 'ثابت' })

    const createPage = await client.get('/customers/create').loginAs(employeeA).withInertia()
    createPage.assertStatus(403)

    const store = await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(employeeA)
      .withInertia()
      .form({ name: 'جديد' })
    store.assertStatus(403)

    const editPage = await client
      .get(`/customers/${customer.id}/edit`)
      .loginAs(employeeA)
      .withInertia()
    editPage.assertStatus(403)

    const update = await client
      .put(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(employeeA)
      .withInertia()
      .form({ name: 'معدل' })
    update.assertStatus(403)

    const destroy = await client
      .delete(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(employeeA)
      .withInertia()
    destroy.assertStatus(403)

    await customer.refresh()
    assert.equal(customer.name, 'ثابت')
    assert.isNull(customer.deletedAt)
    assert.lengthOf(await Customer.all(), 1)
  })

  test('user without a unit is denied', async ({ client }) => {
    const orphan = await makeUser('manager', null)
    const response = await client.get('/customers').loginAs(orphan).withInertia()
    response.assertStatus(403)
    const store = await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(orphan)
      .withInertia()
      .form({ name: 'بلا وحدة' })
    store.assertStatus(403)
  })

  test('requests without a CSRF token are rejected', async ({ client, assert }) => {
    const { managerA } = await makeWorld()
    const response = await client
      .post('/customers')
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'بلا رمز' })
      .redirects(0)
    // Shield redirects back instead of reaching the controller
    response.assertStatus(302)
    assert.notInclude(response.header('location') ?? '', '/customers/')
    assert.lengthOf(await Customer.all(), 0)
  })
})
