import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { kit } from '#services/kit'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

test.group('CSV imports over HTTP', (group) => {
  let clerk: UiActor
  let viewer: UiActor
  group.setup(async () => {
    clerk = await seedActor([{ subject: 'orders', action: 'manage' }], {
      fullName: 'مدخل البيانات',
      level: 0,
    })
    viewer = await seedActor([{ subject: 'orders', action: 'view' }], {
      orgUnitId: clerk.orgUnitId,
      level: 0,
    })
  })

  test('upload, map and import orders; the batch reports failed rows', async ({
    client,
    assert,
  }) => {
    const csv = `ملاحظات,orgUnitId,تاريخ الإصدار\nمستورد أول,${clerk.orgUnitId},2026-10-01\nمستورد ثان,${clerk.orgUnitId},30/02/2026\n`
    const uploaded = await client
      .post('/resources/orders/imports')
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
      .file('file', Buffer.from(csv), { filename: 'orders.csv', contentType: 'text/csv' })
    uploaded.assertStatus(201)
    const batch = uploaded.body().data
    assert.deepEqual(batch.mapping, { 0: 'notes', 1: 'orgUnitId', 2: 'issuedAt' })

    const foreign = await client.get(`/imports/${batch.id}`).loginAs(viewer.user).headers(json)
    foreign.assertStatus(404)
    const started = await client
      .post(`/imports/${batch.id}/start`)
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
      .json({ mapping: batch.mapping })
    started.assertStatus(200)
    await kit().imports.process()
    const page = await client
      .get('/imports')
      .loginAs(clerk.user)
      .header('Accept', 'text/html')
      .withInertia()
    page.assertStatus(200)
    const [done] = page.body().props.batches
    assert.equal(done.status, 'done')
    assert.equal(done.created, 1)
    assert.equal(done.failed, 1)
    assert.equal(done.errors[0].row, 3)
    const imported = await knex()('orders').where('notes', 'مستورد أول').first()
    assert.equal(imported.created_by, clerk.user.id)
  })

  test('users without create permission cannot upload', async ({ client }) => {
    const response = await client
      .post('/resources/orders/imports')
      .loginAs(viewer.user)
      .withCsrfToken()
      .headers(json)
      .file('file', Buffer.from('notes\nx\n'), { filename: 'x.csv' })
    response.assertStatus(403)
  })
})
