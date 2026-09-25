import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { kit } from '#services/kit'
import {
  installSampleResources,
  removeSampleResources,
  seedActor,
  type UiActor,
} from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

test.group('Assignments and my tasks over HTTP', (group) => {
  let manager: UiActor
  let clerk: UiActor
  let outsider: UiActor
  let id: number
  let base: string
  group.setup(async () => {
    manager = await seedActor([{ subject: 'ui_samples', action: 'manage' }], {
      fullName: 'مدير القسم',
      level: 0,
    })
    clerk = await seedActor([{ subject: 'ui_samples', action: 'view' }], {
      orgUnitId: manager.orgUnitId,
      fullName: 'موظف الإدخال',
      level: 0,
    })
    outsider = await seedActor([{ subject: 'ui_samples', action: 'manage' }], {
      fullName: 'موظف خارجي',
      level: 0,
    })
    await installSampleResources()
    const saved = await kit().resources.save(
      'ui_samples',
      await kit().actors.load(manager.user.id),
      { title: 'عينة الإسناد', orgUnitId: manager.orgUnitId }
    )
    id = Number(saved.id)
    base = `/resources/ui_samples/${id}`
    return () => removeSampleResources()
  })
  group.each.setup(async () => {
    await knex()('assignments').del()
  })

  test('manager assigns, the clerk completes from my tasks', async ({ client, assert }) => {
    const created = await client
      .post(`${base}/assignments`)
      .loginAs(manager.user)
      .withCsrfToken()
      .headers(json)
      .json({ assigneeId: clerk.user.id, title: 'مراجعة البيانات', dueOn: '2026-10-05' })
    created.assertStatus(201)
    const assignmentId = created.body().data.id

    const page = await client
      .get('/my-tasks')
      .loginAs(clerk.user)
      .header('Accept', 'text/html')
      .withInertia()
    page.assertStatus(200)
    assert.equal(page.body().component, 'tasks/index')
    assert.equal(page.body().props.assignments.open, 1)
    assert.equal(page.body().props.assignments.data[0].title, 'مراجعة البيانات')

    const cancelByClerk = await client
      .post(`/my-tasks/${assignmentId}/cancel`)
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
    cancelByClerk.assertStatus(403)
    const done = await client
      .post(`/my-tasks/${assignmentId}/complete`)
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
    done.assertStatus(200)
    const listed = await client.get(`${base}/assignments`).loginAs(manager.user).headers(json)
    assert.equal(listed.body().data[0].status, 'done')
  })

  test('a read-only user cannot assign and outsiders never see the record tasks', async ({
    client,
  }) => {
    const denied = await client
      .post(`${base}/assignments`)
      .loginAs(clerk.user)
      .withCsrfToken()
      .headers(json)
      .json({ assigneeId: manager.user.id, title: 'x' })
    denied.assertStatus(403)
    const hidden = await client.get(`${base}/assignments`).loginAs(outsider.user).headers(json)
    hidden.assertStatus(404)
    const refused = await client
      .post(`${base}/assignments`)
      .loginAs(manager.user)
      .withCsrfToken()
      .headers(json)
      .json({ assigneeId: outsider.user.id, title: 'x' })
    refused.assertStatus(422)
  })
})
