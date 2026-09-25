import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { kit } from '#services/kit'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

/**
 * Plan phase 3 acceptance: "the accountant edits only unapproved orders" is
 * configured through the administration screens' HTTP API, without code.
 */
test.group('Conditional policies configured without code', (group) => {
  let admin: UiActor
  let accountant: User
  group.setup(async () => {
    admin = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'مدير الصلاحيات' })
    accountant = await User.create({
      fullName: 'المحاسب',
      email: `accountant-${Date.now()}@example.test`,
      password: 'test-only-password-123',
    })
  })

  test('an accountant updates draft orders only, as configured in the role screen', async ({
    client,
    assert,
  }) => {
    const as = <T extends { loginAs(user: User): T }>(request: T) => request.loginAs(admin.user)
    const role = await as(client.post('/admin/roles'))
      .withCsrfToken()
      .headers(json)
      .json({ name: `المحاسب ${Date.now()}`, permissionLevel: 1 })
    role.assertStatus(200)
    const roleId = role.body().data.id
    for (const rule of [
      { subject: 'orders', action: 'view' },
      { subject: 'orders', action: 'update', conditions: { docStatus: 0 } },
    ]) {
      const response = await as(client.put(`/admin/roles/${roleId}/rules`))
        .withCsrfToken()
        .headers(json)
        .json(rule)
      response.assertStatus(200)
    }
    const unsupported = await as(client.put(`/admin/roles/${roleId}/rules`))
      .withCsrfToken()
      .headers(json)
      .json({ subject: 'orders', action: 'update', conditions: { docStatus: { $regex: '.*' } } })
    unsupported.assertStatus(422)
    {
      const response = await as(client.post(`/admin/users/${accountant.id}/roles`))
        .withCsrfToken()
        .headers(json)
        .json({ roleId })
      response.assertStatus(200)
    }
    {
      const response = await as(client.post(`/admin/users/${accountant.id}/org-units`))
        .withCsrfToken()
        .headers(json)
        .json({ orgUnitId: admin.orgUnitId })
      response.assertStatus(200)
    }

    const creator = await kit().actors.load(admin.user.id)
    const draft = await kit().resources.save('orders', creator, {
      notes: 'مسودة للمحاسب',
      orgUnitId: admin.orgUnitId,
    })
    const approved = await kit().resources.save('orders', creator, {
      notes: 'طلب معتمد',
      orgUnitId: admin.orgUnitId,
    })
    await kit().resources.transition(
      'orders',
      Number(approved.id),
      creator,
      'submit',
      approved.version
    )

    const listed = await client.get('/resources/orders').loginAs(accountant).headers(json)
    listed.assertStatus(200)
    assert.isTrue(listed.body().permissions[String(draft.id)].update)
    assert.isFalse(listed.body().permissions[String(approved.id)].update)

    const edited = await client
      .patch(`/resources/orders/${draft.id}`)
      .loginAs(accountant)
      .withCsrfToken()
      .headers(json)
      .json({ notes: 'عدّلها المحاسب', version: draft.version })
    edited.assertStatus(200)
    const refused = await client
      .patch(`/resources/orders/${approved.id}`)
      .loginAs(accountant)
      .withCsrfToken()
      .headers(json)
      .json({ notes: 'محاولة', version: Number(approved.version) + 1 })
    refused.assertStatus(403)
    const [row] = await knex()('orders').where('id', Number(approved.id))
    assert.equal(row.notes, 'طلب معتمد')
  })
})
