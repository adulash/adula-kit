import { test } from '@japa/runner'
import { kit } from '#services/kit'
import {
  installSampleResources,
  removeSampleResources,
  seedActor,
  type UiActor,
} from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }

test.group('Create form defaults over HTTP (#48)', (group) => {
  let editor: UiActor
  group.setup(async () => {
    editor = await seedActor(
      [
        { subject: 'ui_samples', action: 'manage' },
        { subject: 'customers', action: 'view' },
      ],
      { level: 0 }
    )
    await installSampleResources()
    return () => removeSampleResources()
  })

  test('the create route pre-fills form fields the actor may use', async ({ client, assert }) => {
    const customer = await kit().resources.systemSave(
      'customers',
      { name: `عميل افتراضي ${editor.user.id}` },
      undefined,
      { actorId: editor.user.id }
    )
    const response = await client
      .get('/resources/ui_samples/create')
      .qs({
        'defaults[title]': 'مسودة من المهمة',
        'defaults[status]': 'open',
        'defaults[customerId]': String(customer.id),
        'defaults[quantity]': '4',
        'defaults[createdBy]': '1',
        'defaults[lines]': 'x',
      })
      .loginAs(editor.user)
      .headers(json)
    response.assertStatus(200)
    assert.deepEqual(response.body().defaults, {
      title: 'مسودة من المهمة',
      status: 'open',
      customerId: customer.id,
      quantity: 4,
    })
    assert.include(
      response.body().options.customerId.map((option: { value: string }) => option.value),
      String(customer.id)
    )
  })

  test('unknown lookups and missing records are dropped instead of shown', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get('/resources/ui_samples/create')
      .qs({ 'defaults[status]': 'unknown', 'defaults[customerId]': '2147483647' })
      .loginAs(editor.user)
      .headers(json)
    response.assertStatus(200)
    assert.deepEqual(response.body().defaults, {})
  })
})
