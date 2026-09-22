import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

test.group('Arabic order UI', (group) => {
  let admin: User
  let orgId: number
  group.setup(async () => {
    admin = await User.create({
      fullName: 'اختبار الواجهة',
      email: `${randomUUID()}@example.test`,
      password: 'browser-test-only-password',
    })
    const knex = db.connection().getWriteClient()
    const [org] = await knex('org_units')
      .insert({ name: 'وحدة اختبار الواجهة', type: 'root', path: '888' })
      .returning('id')
    orgId = org.id
    const [role] = await knex('roles')
      .insert({ name: `browser-${randomUUID()}`, permission_level: 1 })
      .returning('id')
    await knex('role_rules').insert({ role_id: role.id, subject: 'all', action: 'manage' })
    await knex('user_roles').insert({ user_id: admin.id, role_id: role.id })
    await knex('user_org_units').insert({ user_id: admin.id, org_unit_id: orgId })
    await knex('lookups')
      .insert({ group: 'order_status', key: 'open', label_ar: 'مفتوح', label_en: 'Open' })
      .onConflict(['group', 'key'])
      .ignore()
  })
  test('create and edit retain money, date, inline rows and version; search filters the list', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin)
    const page = await visit('/resources/orders/create')
    await page.getByRole('dialog').waitFor()
    const notes = `browser${Date.now()}`
    await page.getByLabel('الإجمالي', { exact: true }).fill('١٢٣٤٫٥٦')
    await page.getByLabel('ملاحظات', { exact: true }).fill(notes)
    await page.getByLabel('تاريخ الإصدار', { exact: true }).fill('2026-09-18')
    await page.getByRole('combobox', { name: 'الحالة', exact: true }).click()
    await page.getByRole('option', { name: 'مفتوح', exact: true }).click()
    await page.getByRole('button', { name: 'إضافة بند', exact: true }).click()
    await page.getByLabel('وصف البند 1', { exact: true }).fill('بند متصفح')
    await page.getByLabel('كمية البند 1', { exact: true }).fill('2')
    await page.getByRole('button', { name: 'حفظ الطلب', exact: true }).click()
    await page.waitForURL('**/resources/orders')
    const knex = db.connection().getWriteClient()
    const saved = await knex('orders').where({ notes, org_unit_id: orgId }).first()
    assert.exists(saved)
    assert.equal(saved.total, '123456')
    assert.equal(new Date(saved.issued_at).toISOString().slice(0, 10), '2026-09-18')
    assert.equal(saved.version, 1)
    const createdLine = await knex('order_lines').where('order_id', saved.id).first()
    assert.equal(createdLine.quantity, 2)
    await page.getByLabel('البحث في ملاحظات الطلبات').fill(notes)
    await page.getByLabel('البحث في ملاحظات الطلبات').press('Enter')
    await page.waitForURL(`**/resources/orders?search=${notes}`)
    await page.assertElementsCount('tbody tr', 1)
    await page.getByRole('link', { name: `تعديل الطلب ${saved.number}`, exact: true }).click()
    await page.getByRole('heading', { name: `تعديل ${saved.number}`, exact: true }).waitFor()
    assert.equal(await page.getByLabel('الإجمالي', { exact: true }).inputValue(), '1234.56')
    assert.equal(await page.getByLabel('تاريخ الإصدار', { exact: true }).inputValue(), '2026-09-18')
    await page.getByLabel('الإجمالي', { exact: true }).fill('987.65')
    await page.getByLabel('كمية البند 1', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'حفظ الطلب', exact: true }).click()
    await page.waitForURL('**/resources/orders')
    const updated = await knex('orders').where('id', saved.id).first()
    assert.equal(updated.total, '98765')
    assert.equal(updated.version, 2)
    const updatedLine = await knex('order_lines').where('order_id', saved.id).first()
    assert.equal(updatedLine.quantity, 3)
    assert.equal(updatedLine.version, 2)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.assertVisible(page.getByRole('navigation', { name: 'التنقل على الجوال' }))
    const width = await page.evaluate<number>('document.documentElement.scrollWidth')
    assert.isAtMost(width, page.viewportSize()!.width)
  })
})
