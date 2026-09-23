import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import type { Page } from 'playwright'
import { kit } from '#services/kit'
import {
  installSampleResources,
  removeSampleResources,
  screenshotDir,
  seedActor,
  type UiActor,
} from '#tests/helpers/ui_fixtures'

// The server tsconfig omits the DOM lib; these run inside the page through evaluate().
type Scrollable = {
  scrollTop: number
  scrollHeight: number
  scrollWidth: number
  clientWidth: number
}

const knex = () => db.connection().getWriteClient()
async function service(actor: UiActor) {
  const runtime = kit()
  return { runtime, loaded: await runtime.actors.load(actor.user.id) }
}
async function loadAll(page: Page) {
  for (let round = 0; round < 8; round++) {
    const more = page.getByRole('button', { name: 'تحميل المزيد', exact: true })
    if (!(await more.isVisible())) break
    await more.click()
    await page.getByRole('status').waitFor({ state: 'hidden' })
  }
}

test.group('Generic resource browser acceptance', (group) => {
  let admin: UiActor
  let viewer: UiActor
  let customerName: string
  let orderNumber: string
  let orderNotes: string
  let shots: string
  group.setup(async () => {
    admin = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'مدير الواجهة' })
    viewer = await seedActor([{ subject: 'customers', action: 'view' }], {
      level: 0,
      orgUnitId: admin.orgUnitId,
      fullName: 'قارئ العملاء',
    })
    await installSampleResources()
    const { runtime, loaded } = await service(admin)
    customerName = `عميل المتصفح ${randomUUID().slice(0, 8)}`
    await runtime.resources.save('customers', loaded, { name: customerName })
    orderNotes = `طلب متصفح ${randomUUID().slice(0, 8)}`
    const order = await runtime.resources.save('orders', loaded, {
      orgUnitId: admin.orgUnitId,
      notes: orderNotes,
    })
    orderNumber = String(order.number)
    shots = await screenshotDir()
    return () => removeSampleResources()
  })

  test('customers: create, show with deferred activity, edit and delete', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin.user)
    const page = await visit('/resources/customers/create')
    await page.getByRole('dialog', { name: 'إضافة · العملاء' }).waitFor()
    const name = `عميل عام ${randomUUID().slice(0, 8)}`
    await page.getByLabel('اسم العميل', { exact: true }).fill(name)
    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('generic@example.test')
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.waitForURL(/\/resources\/customers\/\d+$/)
    await page.getByRole('heading', { name: 'تفاصيل · العملاء' }).waitFor()
    await page.getByRole('dialog', { name: 'تفاصيل · العملاء' }).waitFor()
    await page.assertVisible(page.getByText(name, { exact: true }))
    const activity = page.getByRole('region', { name: 'سجل النشاط' })
    await activity.getByText('إنشاء السجل', { exact: true }).waitFor()
    // History shows who acted by display name; account e-mails stay private.
    await page.assertVisible(activity.getByText('مدير الواجهة'))
    assert.equal(await activity.getByText(admin.user.email).count(), 0)
    const saved = await knex()('customers').where({ name }).first()
    assert.exists(saved)
    await page.getByRole('link', { name: 'تعديل السجل', exact: true }).click()
    await page.waitForURL(/\/edit$/)
    await page.getByRole('dialog', { name: 'تعديل · العملاء' }).waitFor()
    assert.equal(await page.getByLabel('اسم العميل', { exact: true }).inputValue(), name)
    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('updated@example.test')
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.waitForURL(new RegExp(`/resources/customers/${saved.id}$`))
    await page.assertVisible(page.getByText('updated@example.test'))
    await page.getByText('تعديل السجل', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'حذف السجل', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'حذف السجل', exact: true })
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'تأكيد', exact: true }).click()
    await page.waitForURL(/\/resources\/customers$/)
    const deleted = await knex()('customers').where({ id: saved.id }).first()
    assert.isNotNull(deleted.deleted_at)
  })

  test('tasks: belongsTo search, switch, required validation and mobile form', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin.user)
    const page = await visit('/resources/tasks/create')
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.assertVisible(page.getByText('هذا الحقل مطلوب', { exact: true }))
    const title = `مهمة المتصفح ${randomUUID().slice(0, 8)}`
    await page.getByLabel('المهمة', { exact: true }).fill(title)
    await page.getByRole('combobox', { name: 'الطلب' }).click()
    await page.getByPlaceholder('ابحث في السجلات المرتبطة').fill(orderNotes)
    await page.getByRole('option', { name: orderNumber, exact: true }).click()
    await page.assertVisible(page.getByRole('combobox', { name: 'الطلب' }).getByText(orderNumber))
    await page.getByRole('switch', { name: 'مكتملة' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: join(shots, 'form-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.waitForURL(/\/resources\/tasks\/\d+$/)
    await page.assertVisible(page.getByText(title, { exact: true }))
    await page.assertVisible(page.getByText(orderNumber, { exact: true }))
    await page.assertVisible(page.getByText('نعم', { exact: true }))
    const task = await knex()('tasks').where({ title }).first()
    assert.equal(task.done, true)
    assert.equal(task.org_unit_id, admin.orgUnitId)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText('إنشاء السجل', { exact: true }).waitFor()
    await page.screenshot({ path: join(shots, 'show-mobile.png'), fullPage: true })
  })

  test('sample resource: every field control saves, displays, edits inline rows and reports conflicts', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin.user)
    const page = await visit('/resources/ui_samples/create')
    const title = `عينة ${randomUUID().slice(0, 8)}`
    await page.getByLabel('العنوان', { exact: true }).fill(title)
    await page.getByLabel('ملاحظات', { exact: true }).fill('ملاحظة\nسطر ثانٍ')
    await page.getByLabel('الكمية', { exact: true }).fill('3')
    await page.getByLabel('المبلغ', { exact: true }).fill('١٢٣٤٫٥')
    await page.getByLabel('المبلغ', { exact: true }).blur()
    assert.equal(await page.getByLabel('المبلغ', { exact: true }).inputValue(), '1234.50')
    await page.getByRole('switch', { name: 'مفعل' }).click()
    await page.getByLabel('اليوم', { exact: true }).fill('2026-09-18')
    await page.getByLabel('الوقت', { exact: true }).fill('2026-09-18T10:30')
    await page.getByLabel('التفاصيل', { exact: true }).fill('{"a":1,"b":[1,2]}')
    await page.getByRole('button', { name: 'تنسيق JSON', exact: true }).click()
    assert.include(await page.getByLabel('التفاصيل', { exact: true }).inputValue(), '"a": 1')
    await page.getByRole('combobox', { name: 'العميل' }).click()
    await page.getByPlaceholder('ابحث في السجلات المرتبطة').fill(customerName)
    await page.getByRole('option', { name: customerName, exact: true }).click()
    await page.getByRole('combobox', { name: 'الحالة', exact: true }).click()
    await page.getByRole('option', { name: 'مفتوح', exact: true }).click()
    await page
      .getByLabel('المرفق', { exact: true })
      .setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('مرفق') })
    await page.getByRole('link', { name: 'note.txt', exact: true }).waitFor()
    await page.getByRole('button', { name: 'إضافة بند', exact: true }).click()
    await page.getByLabel('الصنف للبند 1', { exact: true }).fill('صنف أول')
    await page.getByLabel('العدد للبند 1', { exact: true }).fill('2')
    await page.screenshot({ path: join(shots, 'form-desktop.png'), fullPage: true })
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.waitForURL(/\/resources\/ui_samples\/\d+$/)
    await page.getByRole('heading', { name: 'تفاصيل · عينات الواجهة' }).waitFor()
    await page.assertVisible(page.getByText('1,234.50'))
    await page.assertVisible(page.getByText('مفتوح', { exact: true }))
    await page.assertVisible(page.getByText(customerName, { exact: true }))
    await page.assertVisible(page.locator('dd', { hasText: /18.{0,2}\/09.{0,2}\/2026/ }).first())
    await page.assertVisible(page.locator('pre', { hasText: '"a": 1' }))
    await page.assertVisible(page.getByText('نعم', { exact: true }))
    await page.getByText('صنف أول', { exact: true }).waitFor()
    await page.getByText('إنشاء السجل', { exact: true }).waitFor()
    await page.assertVisible(page.getByRole('link', { name: /note\.txt/ }))
    await page.screenshot({ path: join(shots, 'show-desktop.png'), fullPage: true })
    const stored = await knex()('ui_samples')
      .where({ title })
      .first(
        'id',
        'version',
        'amount',
        'quantity',
        'enabled',
        'instant',
        'details',
        knex().raw("to_char(day, 'YYYY-MM-DD') as day")
      )
    assert.equal(stored.amount, '123450')
    assert.equal(stored.quantity, 3)
    assert.equal(stored.enabled, true)
    assert.equal(stored.day, '2026-09-18')
    // The control turns the naive input into an instant in the browser's zone, not the server's.
    const expectedInstant = await page.evaluate(() => new Date('2026-09-18T10:30').toISOString())
    assert.equal(new Date(stored.instant).toISOString(), expectedInstant)
    assert.deepEqual(stored.details, { a: 1, b: [1, 2] })
    const line = await knex()('ui_sample_lines').where({ sample_id: stored.id }).first()
    assert.equal(line.count, 2)
    await page.getByRole('link', { name: 'تعديل السجل', exact: true }).click()
    await page.waitForURL(/\/edit$/)
    await page.getByLabel('العدد للبند 1', { exact: true }).fill('5')
    await page.getByRole('button', { name: 'إضافة بند', exact: true }).click()
    await page.getByLabel('الصنف للبند 2', { exact: true }).fill('صنف ثانٍ')
    await page.getByLabel('العدد للبند 2', { exact: true }).fill('1')
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.waitForURL(new RegExp(`/resources/ui_samples/${stored.id}$`))
    const lines = await knex()('ui_sample_lines').where({ sample_id: stored.id }).orderBy('id')
    assert.lengthOf(lines, 2)
    assert.equal(lines[0].count, 5)
    assert.equal(lines[0].version, 2)
    const updated = await knex()('ui_samples').where({ id: stored.id }).first('version')
    assert.equal(updated.version, 2)
    await page.getByRole('link', { name: 'تعديل السجل', exact: true }).click()
    await page.waitForURL(/\/edit$/)
    const { runtime, loaded } = await service(admin)
    await runtime.resources.save(
      'ui_samples',
      loaded,
      { title: `${title} متزامن`, version: 2 },
      stored.id
    )
    await page.getByLabel('العنوان', { exact: true }).fill(`${title} متأخر`)
    await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
    await page.assertVisible(page.getByText('تعارض في الإصدار', { exact: true }))
    await page.assertVisible(page.getByRole('button', { name: 'إعادة التحميل', exact: true }))
    const untouched = await knex()('ui_samples').where({ id: stored.id }).first('title', 'version')
    assert.equal(untouched.title, `${title} متزامن`)
    assert.equal(untouched.version, 3)
  })

  test('modal routes support mobile, keyboard dismissal, direct detail URLs and an explicit page override', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin.user)
    const page = await visit('/resources/customers')
    await page.getByRole('link', { name: 'إضافة سجل', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'إضافة · العملاء' })
    await form.waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    // Measure the settled modal, not its opening animation across a viewport resize.
    await form.evaluate(async (element: { getAnimations(): { finished: Promise<unknown> }[] }) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished))
    })
    await page.screenshot({ path: join(shots, 'dialog-mobile.png'), fullPage: true })
    const bounds = await form.boundingBox()
    assert.exists(bounds)
    assert.isAtLeast(bounds!.x, 12)
    assert.isAtMost(bounds!.x + bounds!.width, 378)
    assert.isAtMost(bounds!.height, 844)
    await page.getByLabel('اسم العميل', { exact: true }).focus()
    for (let index = 0; index < 9; index++) {
      await page.keyboard.press('Tab')
      assert.isTrue(
        await page.evaluate<boolean>(
          'Boolean(document.activeElement?.closest(\'[role="dialog"]\'))'
        )
      )
    }
    await page.screenshot({ path: join(shots, 'dialog-mobile.png'), fullPage: true })
    await page.getByLabel('اسم العميل', { exact: true }).fill('مسودة محفوظة في النموذج')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'إغلاق النموذج؟' }).waitFor()
    await page.getByRole('button', { name: 'متابعة التحرير', exact: true }).click()
    assert.equal(
      await page.getByLabel('اسم العميل', { exact: true }).inputValue(),
      'مسودة محفوظة في النموذج'
    )
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 4, y: 4 } })
    await page.getByRole('button', { name: 'إغلاق دون حفظ', exact: true }).click()
    await page.waitForURL(/\/resources\/customers$/)
    await page.getByRole('heading', { name: 'العملاء', exact: true }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page
      .getByRole('link', { name: /عرض السجل/ })
      .first()
      .click()
    await page.getByRole('dialog', { name: 'تفاصيل · العملاء' }).waitFor()
    await page.reload()
    await page.getByRole('dialog', { name: 'تفاصيل · العملاء' }).waitFor()
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 4, y: 4 } })
    await page.waitForURL(/\/resources\/customers$/)

    // Change only the presentation prop of a real authorized Inertia response.
    // A project-owned page can pass this prop after the user requests a page.
    await page.route('**/resources/customers/create', async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      body.props.presentation = 'page'
      await route.fulfill({ response, json: body })
    })
    await page.getByRole('link', { name: 'إضافة سجل', exact: true }).click()
    await page.getByRole('heading', { name: 'إضافة · العملاء' }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.assertVisible(page.getByLabel('اسم العميل', { exact: true }))
    await page.getByRole('link', { name: 'العودة إلى القائمة', exact: true }).click()
    await page.waitForURL(/\/resources\/customers$/)
  })

  test('sample index: search, sort, filters and CSV export of the loaded rows', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const { runtime, loaded } = await service(admin)
    const stamp = randomUUID().slice(0, 8)
    // Counting unfiltered rows only works when this test owns every sample row.
    await knex()('ui_sample_lines').del()
    await knex()('ui_samples').del()
    for (const quantity of [1, 2, 3])
      await runtime.resources.save('ui_samples', loaded, {
        orgUnitId: admin.orgUnitId,
        title: `عينة الفرز ${quantity} ${stamp}`,
        quantity,
        enabled: quantity === 2,
        status: quantity === 3 ? 'closed' : 'open',
      })
    await browserContext.loginAs(admin.user)
    const page = await visit('/resources/ui_samples')
    await page.getByRole('heading', { name: 'عينات الواجهة', exact: true }).waitFor()
    await page.screenshot({ path: join(shots, 'index-desktop.png'), fullPage: true })
    await page.getByLabel('البحث في عينات الواجهة').fill(`عينة الفرز 2 ${stamp}`)
    await page.getByLabel('البحث في عينات الواجهة').press('Enter')
    await page.waitForURL(/search=/)
    await page.assertElementsCount('tbody tr[aria-rowindex]', 1)
    await page.getByRole('button', { name: 'الكمية' }).click()
    await page.waitForURL(/sort=quantity&direction=asc/)
    await page.assertElementsCount('tbody tr[aria-rowindex]', 1)
    await page.goto(
      page
        .url()
        .replace(/[?&]search=[^&]*/, '')
        .replace('ui_samples&', 'ui_samples?')
    )
    await page.getByRole('button', { name: 'الكمية' }).waitFor()
    assert.equal(await page.locator('th[aria-sort]').getAttribute('aria-sort'), 'ascending')
    const firstQuantity = () =>
      page.locator('tbody tr[aria-rowindex]').first().locator('td').nth(1).innerText()
    assert.equal(await firstQuantity(), '1')
    await page.getByRole('button', { name: 'الكمية' }).click()
    await page.waitForURL(/sort=quantity&direction=desc/)
    assert.equal(await firstQuantity(), '3')
    await page.getByLabel('الحالة').selectOption('closed')
    await page.waitForURL(/filters%5Bstatus%5D=closed/)
    await page.assertElementsCount('tbody tr[aria-rowindex]', 1)
    await page.getByLabel('مفعل').selectOption('true')
    await page.waitForURL(/filters%5Benabled%5D=true/)
    await page.assertVisible(page.getByText('لا توجد سجلات مطابقة'))
    await page.getByRole('button', { name: 'مسح التصفية' }).click()
    await page.waitForURL((url) => !url.search.includes('filters'))
    await page.assertElementsCount('tbody tr[aria-rowindex]', 3)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'تصدير المعروض', exact: true }).click()
    const file = await download
    assert.equal(file.suggestedFilename(), 'عينات الواجهة.csv')
    const chunks: Buffer[] = []
    for await (const chunk of await file.createReadStream()) chunks.push(Buffer.from(chunk))
    const csv = Buffer.concat(chunks).toString('utf8')
    assert.isTrue(csv.startsWith('﻿"العنوان","الكمية","المبلغ","مفعل","اليوم","العميل","الحالة"'))
    assert.include(csv, `"عينة الفرز 3 ${stamp}","3"`)
    assert.include(csv, '"مغلق"')
  })

  test('250 tasks load through the scroll prop and render virtualized rows; mobile keeps no page overflow', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const stamp = randomUUID().slice(0, 8)
    await knex()('tasks').insert(
      Array.from({ length: 250 }, (_, index) => ({
        title: `مهمة افتراضية ${index + 1} ${stamp}`,
        done: false,
        org_unit_id: admin.orgUnitId,
        created_by: admin.user.id,
        updated_by: admin.user.id,
      }))
    )
    await browserContext.loginAs(admin.user)
    const page = await visit('/resources/tasks')
    await page.getByRole('heading', { name: 'المهام', exact: true }).waitFor()
    await page.assertElementsCount('tbody tr[aria-rowindex]', 25)
    await loadAll(page)
    await page.getByText('نهاية السجلات', { exact: true }).waitFor()
    const shown = await page.getByText(/\d+ معروض/).innerText()
    assert.isAtLeast(Number.parseInt(shown, 10), 250)
    const rendered = await page.locator('tbody tr[aria-rowindex]').count()
    assert.isBelow(rendered, 80)
    await page.assertVisible(page.getByText(`مهمة افتراضية 1 ${stamp}`, { exact: true }))
    const scroller = page.locator('[data-slot="table-scroll"]')
    await scroller.evaluate((element: Scrollable) => {
      element.scrollTop = element.scrollHeight
    })
    await page.getByText(`مهمة افتراضية 250 ${stamp}`, { exact: true }).waitFor()
    assert.isBelow(await page.locator('tbody tr[aria-rowindex]').count(), 80)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.assertVisible(page.getByRole('navigation', { name: 'التنقل على الجوال' }))
    assert.isAtMost(await page.evaluate<number>('document.documentElement.scrollWidth'), 390)
    assert.isTrue(
      await scroller.evaluate((element: Scrollable) => element.scrollWidth > element.clientWidth)
    )
    await page.screenshot({ path: join(shots, 'index-mobile.png'), fullPage: false })
  })

  test('a viewer without write permissions sees no create, edit or delete controls', async ({
    browserContext,
    visit,
  }) => {
    await browserContext.loginAs(viewer.user)
    const page = await visit('/resources/customers')
    await page.getByRole('heading', { name: 'العملاء', exact: true }).waitFor()
    await page
      .getByRole('link', { name: /عرض السجل/ })
      .first()
      .waitFor()
    await page.assertElementsCount('a[href="/resources/customers/create"]', 0)
    await page.assertElementsCount('a[href$="/edit"]', 0)
    await page.assertElementsCount('button:has-text("حذف السجل")', 0)
    await page
      .getByRole('link', { name: /عرض السجل/ })
      .first()
      .click()
    await page.waitForURL(/\/resources\/customers\/\d+$/)
    await page.getByText('سجل النشاط', { exact: true }).waitFor()
    await page.assertElementsCount('a[href$="/edit"]', 0)
    await page.assertElementsCount('button:has-text("حذف السجل")', 0)
  })
  test('both calendars persist in settings and roundtrip either input through one stored date', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin.user)
    const previous = await knex()('settings')
      .where({ key: 'ui.preferences', scope: 'system', scope_id: '0' })
      .first()
    try {
      const page = await visit('/admin/settings')
      await page.getByRole('combobox', { name: 'عرض التاريخ', exact: true }).click()
      await page.getByRole('option', { name: 'الميلادي والهجري معًا', exact: true }).click()
      await page.getByRole('button', { name: 'حفظ تفضيلات الواجهة', exact: true }).click()
      await page.getByText('تم حفظ الإعداد', { exact: true }).waitFor()
      const storedPreferences = await knex()('settings')
        .where({ key: 'ui.preferences', scope: 'system', scope_id: '0' })
        .first()
      assert.equal(storedPreferences.value.calendar, 'both')
      await page.reload()
      await page
        .getByRole('combobox', { name: 'عرض التاريخ' })
        .getByText('الميلادي والهجري معًا')
        .waitFor()
      await page.goto('/resources/ui_samples/create')
      const title = `تاريخ مزدوج ${randomUUID().slice(0, 8)}`
      await page.getByLabel('العنوان', { exact: true }).fill(title)
      const inputCalendar = page.getByRole('group', { name: 'تقويم الإدخال: اليوم', exact: true })
      await inputCalendar.getByRole('button', { name: 'إدخال هجري', exact: true }).click()
      await page.getByLabel('اليوم', { exact: true }).fill('١٤٣٩-٠١-٢٤')
      await page.getByText('(2017-10-14 ميلادي)', { exact: true }).waitFor()
      await inputCalendar.getByRole('button', { name: 'إدخال ميلادي', exact: true }).click()
      assert.equal(await page.getByLabel('اليوم', { exact: true }).inputValue(), '2017-10-14')
      await inputCalendar.getByRole('button', { name: 'إدخال هجري', exact: true }).click()
      await page.getByRole('button', { name: 'التقويم: اليوم', exact: true }).click()
      await page.locator('[data-slot="popover-content"] button[aria-pressed="true"]').waitFor()
      // A calendar popover must not count as clicking outside the editor.
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog', { name: 'إغلاق النموذج؟' }).count(), 0)
      await page.getByRole('button', { name: 'حفظ السجل', exact: true }).click()
      await page.waitForURL(/\/resources\/ui_samples\/\d+$/)
      const stored = await knex()('ui_samples').where({ title }).first()
      assert.equal(new Date(stored.day).toISOString().slice(0, 10), '2017-10-14')
      await page
        .locator('dd')
        .filter({ hasText: /2017.*1439/ })
        .waitFor()
      await page.reload()
      await page
        .locator('dd')
        .filter({ hasText: /2017.*1439/ })
        .waitFor()
      await page.getByRole('link', { name: 'تعديل السجل', exact: true }).click()
      assert.equal(await page.getByLabel('اليوم', { exact: true }).inputValue(), '2017-10-14')
      await page.screenshot({ path: join(shots, 'both-calendars.png'), fullPage: true })
    } finally {
      await knex()('settings')
        .where({ key: 'ui.preferences', scope: 'system', scope_id: '0' })
        .delete()
      if (previous) await knex()('settings').insert(previous)
    }
  })
})
