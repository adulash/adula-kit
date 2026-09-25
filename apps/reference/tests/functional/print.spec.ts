import { test } from '@japa/runner'
import { kit } from '#services/kit'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

test.group('Record printing', (group) => {
  let owner: UiActor
  let reader: UiActor
  let outsider: UiActor
  let id: number
  group.setup(async () => {
    owner = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'الطابع' })
    reader = await seedActor([{ subject: 'orders', action: 'view' }], {
      orgUnitId: owner.orgUnitId,
      level: 0,
    })
    outsider = await seedActor([{ subject: 'orders', action: 'view' }], { level: 0 })
    const saved = await kit().resources.save('orders', await kit().actors.load(owner.user.id), {
      notes: 'طلب للطباعة',
      total: '990000',
      internalNote: 'لا تطبع للقارئ',
      orgUnitId: owner.orgUnitId,
    })
    id = Number(saved.id)
  })

  test('prints an RTL page with only the fields the reader may see', async ({ client, assert }) => {
    const full = await client.get(`/resources/orders/${id}/print`).loginAs(owner.user)
    full.assertStatus(200)
    assert.include(full.header('content-type'), 'text/html')
    assert.include(full.text(), 'dir="rtl"')
    assert.include(full.text(), 'طلب للطباعة')
    assert.include(full.text(), 'لا تطبع للقارئ')
    assert.include(full.text(), 'طُبع بواسطة الطابع')
    const limited = await client.get(`/resources/orders/${id}/print`).loginAs(reader.user)
    limited.assertStatus(200)
    assert.notInclude(limited.text(), 'لا تطبع للقارئ')
    assert.notInclude(limited.text(), 'الإجمالي')
    assert.include(full.text(), 'الإجمالي')
  })

  test('out-of-scope users get 404 and PDF without Gotenberg is 501', async ({ client }) => {
    const hidden = await client
      .get(`/resources/orders/${id}/print`)
      .loginAs(outsider.user)
      .header('Accept', 'application/json')
    hidden.assertStatus(404)
    const pdf = await client
      .get(`/resources/orders/${id}/print`)
      .qs({ format: 'pdf' })
      .loginAs(owner.user)
      .header('Accept', 'application/json')
    pdf.assertStatus(501)
  })
})
