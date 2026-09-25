import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Customer from '#models/customer'
import { inputErrors, makeCustomer, makeWorld } from '#tests/helpers'

test.group('Customers | CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('guests are redirected to login', async ({ client }) => {
    const response = await client.get('/customers').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('manager creates a customer in their own unit', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()

    const response = await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({
        name: '  شركة النور  ',
        email: 'info@alnoor.example',
        phone: '+966 50 123 4567',
        address: 'الرياض',
      })
      .redirects(0)

    const customer = await Customer.findByOrFail('name', 'شركة النور')
    response.assertStatus(302)
    response.assertHeader('location', `/customers/${customer.id}`)
    assert.equal(customer.unitId, unitA.id)
    assert.equal(customer.createdBy, managerA.id)
    assert.equal(customer.email, 'info@alnoor.example')
    assert.isNull(customer.deletedAt)
  })

  test('optional fields may be left empty', async ({ client, assert }) => {
    const { managerA } = await makeWorld()

    await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'عميل بلا بيانات', email: '', phone: '', address: '' })
      .redirects(0)

    const customer = await Customer.findByOrFail('name', 'عميل بلا بيانات')
    assert.isNull(customer.email)
    assert.isNull(customer.phone)
    assert.isNull(customer.address)
  })

  test('name is required and email/phone must be valid', async ({ client, assert }) => {
    const { managerA } = await makeWorld()

    const response = await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .header('referer', '/customers/create')
      .form({ name: '', email: 'not-an-email', phone: 'abc' })
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/customers/create')
    const errors = inputErrors(response)
    assert.deepEqual(errors.name, ['حقل الاسم مطلوب'])
    assert.deepEqual(errors.email, ['صيغة البريد الإلكتروني غير صحيحة'])
    assert.deepEqual(errors.phone, ['صيغة الهاتف غير صحيحة'])
    assert.lengthOf(await Customer.all(), 0)
  })

  test('name must be unique, ignoring case and surrounding spaces', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    await makeCustomer(unitA, { name: 'Acme Trading' })

    const response = await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: '  acme trading ' })
      .redirects(0)

    response.assertStatus(302)
    assert.deepEqual(inputErrors(response).name, ['قيمة الاسم مستخدمة مسبقاً'])
    assert.lengthOf(await Customer.all(), 1)
  })

  test('name uniqueness applies across units', async ({ client, assert }) => {
    const { managerA, unitB } = await makeWorld()
    await makeCustomer(unitB, { name: 'عميل مشترك' })

    const response = await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'عميل مشترك' })
      .redirects(0)

    assert.deepEqual(inputErrors(response).name, ['قيمة الاسم مستخدمة مسبقاً'])
  })

  test('the database rejects duplicate active names even without the validator', async ({
    assert,
  }) => {
    const { unitA } = await makeWorld()
    await makeCustomer(unitA, { name: 'مكرر' })
    await assert.rejects(() =>
      db.table('customers').insert({ unit_id: unitA.id, name: 'مكرر', created_at: new Date() })
    )
  })

  test('detail page shows the customer with permissions', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    const customer = await makeCustomer(unitA, { name: 'عميل التفاصيل', phone: '0501234567' })

    const response = await client.get(`/customers/${customer.id}`).loginAs(managerA).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('customers/show')
    assert.equal(response.inertiaProps.customer.name, 'عميل التفاصيل')
    assert.equal(response.inertiaProps.customer.phone, '0501234567')
    assert.deepEqual(response.inertiaProps.can, { update: true, delete: true })
  })

  test('manager updates a customer and may keep its own name', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    const customer = await makeCustomer(unitA, { name: 'الاسم القديم', email: 'old@example.test' })

    const response = await client
      .put(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'الاسم القديم', email: '', phone: '0551112222' })
      .redirects(0)

    // Inertia turns redirects after PUT/DELETE into 303 See Other
    response.assertStatus(303)
    response.assertHeader('location', `/customers/${customer.id}`)
    await customer.refresh()
    assert.isNull(customer.email)
    assert.equal(customer.phone, '0551112222')
    assert.equal(customer.updatedBy, managerA.id)
  })

  test('update rejects a name used by another customer', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    await makeCustomer(unitA, { name: 'الأول' })
    const second = await makeCustomer(unitA, { name: 'الثاني' })

    const response = await client
      .put(`/customers/${second.id}`)
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'الأول' })
      .redirects(0)

    assert.deepEqual(inputErrors(response).name, ['قيمة الاسم مستخدمة مسبقاً'])
    await second.refresh()
    assert.equal(second.name, 'الثاني')
  })
})

test.group('Customers | soft delete', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('delete keeps the row, stamps it and hides it everywhere', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    const customer = await makeCustomer(unitA, { name: 'سيحذف' })

    const response = await client
      .delete(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .redirects(0)

    response.assertStatus(303)
    response.assertHeader('location', '/customers')

    await customer.refresh()
    assert.isNotNull(customer.deletedAt)
    assert.equal(customer.deletedBy, managerA.id)

    const list = await client.get('/customers').loginAs(managerA).withInertia()
    assert.lengthOf(list.inertiaProps.customers.data, 0)

    const show = await client.get(`/customers/${customer.id}`).loginAs(managerA).withInertia()
    show.assertStatus(404)

    const edit = await client
      .put(`/customers/${customer.id}`)
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'إحياء' })
    edit.assertStatus(404)
  })

  test('the name of a deleted customer can be reused', async ({ client, assert }) => {
    const { managerA, unitA } = await makeWorld()
    const old = await makeCustomer(unitA, { name: 'اسم متاح' })
    await client.delete(`/customers/${old.id}`).withCsrfToken().loginAs(managerA).withInertia()

    await client
      .post('/customers')
      .withCsrfToken()
      .loginAs(managerA)
      .withInertia()
      .form({ name: 'اسم متاح' })
      .redirects(0)

    const rows = await Customer.query().where('name', 'اسم متاح').orderBy('id')
    assert.lengthOf(rows, 2)
    assert.isNotNull(rows[0].deletedAt)
    assert.isNull(rows[1].deletedAt)
  })
})
