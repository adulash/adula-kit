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

test.group('Record collaboration over HTTP', (group) => {
  let owner: UiActor
  let colleague: UiActor
  let reader: UiActor
  let outsider: UiActor
  let id: number
  let base: string
  group.setup(async () => {
    owner = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'هند المالكة' })
    colleague = await seedActor([{ subject: 'ui_samples', action: 'manage' }], {
      orgUnitId: owner.orgUnitId,
      fullName: 'ياسر الزميل',
      level: 0,
    })
    reader = await seedActor([{ subject: 'ui_samples', action: 'view' }], {
      orgUnitId: owner.orgUnitId,
      fullName: 'ريم القارئة',
      level: 0,
    })
    // Same permissions as the colleague, but in a different organization.
    outsider = await seedActor([{ subject: 'ui_samples', action: 'manage' }], {
      fullName: 'عمر الخارجي',
    })
    await installSampleResources()
    const actor = await kit().actors.load(owner.user.id)
    const saved = await kit().resources.save('ui_samples', actor, {
      title: 'عينة للتعاون',
      amount: 1200,
      orgUnitId: owner.orgUnitId,
    })
    id = Number(saved.id)
    base = `/resources/ui_samples/${id}`
    return () => removeSampleResources()
  })
  group.each.setup(async () => {
    await knex()('comments').del()
    await knex()('followers').del()
    await knex()('notifications').del()
  })

  test('comment with a mention notifies the mentioned colleague', async ({ client, assert }) => {
    const candidates = await client.get(`${base}/mentions`).loginAs(owner.user).headers(json)
    candidates.assertStatus(200)
    const names = candidates.body().data.map((user: { name: string }) => user.name)
    assert.includeMembers(names, ['ياسر الزميل', 'ريم القارئة'])
    assert.notInclude(names, 'عمر الخارجي')

    const created = await client
      .post(`${base}/comments`)
      .loginAs(owner.user)
      .withCsrfToken()
      .headers(json)
      .json({ body: 'راجعوا الكمية من فضلكم', mentions: [colleague.user.id] })
    created.assertStatus(201)
    const inbox = await knex()('notifications').where('user_id', colleague.user.id)
    assert.lengthOf(inbox, 1)
    assert.include(inbox[0].title, 'هند المالكة')

    const state = await client.get(`${base}/collaboration`).loginAs(reader.user).headers(json)
    state.assertStatus(200)
    assert.equal(state.body().comments[0].body, 'راجعوا الكمية من فضلكم')
    assert.isFalse(state.body().canTag)
  })

  test('mentioning an out-of-scope user is refused', async ({ client, assert }) => {
    const response = await client
      .post(`${base}/comments`)
      .loginAs(owner.user)
      .withCsrfToken()
      .headers(json)
      .json({ body: 'تسريب؟', mentions: [outsider.user.id] })
    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_MENTION')
  })

  test('users outside the record scope get 404 on every collaboration route', async ({
    client,
  }) => {
    const requests = [
      client.get(`${base}/collaboration`),
      client.get(`${base}/mentions`),
      client.post(`${base}/comments`).json({ body: 'x' }),
      client.put(`${base}/follow`).json({ following: true }),
      client.put(`${base}/tags`).json({ tags: ['x'] }),
    ]
    for (const request of requests) {
      const response = await request.loginAs(outsider.user).withCsrfToken().headers(json)
      response.assertStatus(404)
    }
  })

  test('tags need update permission and filter the list', async ({ client, assert }) => {
    const denied = await client
      .put(`${base}/tags`)
      .loginAs(reader.user)
      .withCsrfToken()
      .headers(json)
      .json({ tags: ['عاجل'] })
    denied.assertStatus(403)
    const tagged = await client
      .put(`${base}/tags`)
      .loginAs(colleague.user)
      .withCsrfToken()
      .headers(json)
      .json({ tags: ['عاجل'] })
    tagged.assertStatus(200)
    assert.deepEqual(tagged.body().data, ['عاجل'])
    const list = await client
      .get('/resources/ui_samples')
      .qs({ tag: 'عاجل' })
      .loginAs(reader.user)
      .headers(json)
    list.assertStatus(200)
    assert.deepEqual(
      list.body().data.map((row: { id: number }) => row.id),
      [id]
    )
    const options = await client
      .get('/resources/ui_samples/tag-options')
      .loginAs(reader.user)
      .headers(json)
    assert.deepEqual(options.body().data, ['عاجل'])
  })

  test('field history hides fields the viewer may not read', async ({ client, assert }) => {
    const current = await kit().resources.show(
      'ui_samples',
      id,
      await kit().actors.load(owner.user.id)
    )
    const updated = await client
      .patch(base)
      .loginAs(owner.user)
      .withCsrfToken()
      .headers(json)
      .json({ title: 'عنوان معدّل', amount: 1800, version: current.data.version })
    updated.assertStatus(200)
    const state = await client.get(`${base}/collaboration`).loginAs(owner.user).headers(json)
    const fields = state.body().changes.map((change: { field: string }) => change.field)
    assert.includeMembers(fields, ['title', 'amount'])
    const title = state.body().changes.find((change: { field: string }) => change.field === 'title')
    assert.equal(title.after, 'عنوان معدّل')
  })

  test('the follower listener notifies followers on update, not the editor', async ({
    client,
    assert,
  }) => {
    await client
      .put(`${base}/follow`)
      .loginAs(reader.user)
      .withCsrfToken()
      .headers(json)
      .json({ following: true })
      .then((response) => response.assertStatus(200))
    const listener = kit().collaboration.followerListener('ui_fixtures', 'ui_samples', 'updated')
    await knex().transaction((trx) =>
      listener.handle(
        { id: 'e-1', event: listener.event, payload: { id, actorId: owner.user.id } },
        trx
      )
    )
    const inbox = await knex()('notifications').pluck('user_id')
    assert.deepEqual(inbox, [reader.user.id])
  })
})
