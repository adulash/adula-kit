import { test } from '@japa/runner'
import { join } from 'node:path'
import { kit } from '#services/kit'
import {
  installSampleResources,
  removeSampleResources,
  screenshotDir,
  seedActor,
  type UiActor,
} from '#tests/helpers/ui_fixtures'

test.group('Record collaboration browser acceptance', (group) => {
  let owner: UiActor
  let colleague: UiActor
  let id: number
  group.setup(async () => {
    owner = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'نورة المشرفة' })
    colleague = await seedActor([{ subject: 'ui_samples', action: 'view' }], {
      orgUnitId: owner.orgUnitId,
      fullName: 'فهد المراجع',
      level: 0,
    })
    await installSampleResources()
    const actor = await kit().actors.load(owner.user.id)
    const saved = await kit().resources.save('ui_samples', actor, {
      title: 'عينة التعليقات',
      orgUnitId: owner.orgUnitId,
    })
    id = Number(saved.id)
    return () => removeSampleResources()
  })

  test('comment with a mention, tag the record and follow it from the detail view', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(owner.user)
    const page = await visit(`/resources/ui_samples/${id}`)
    const panel = page.getByRole('region', { name: 'التعاون حول السجل' })
    await panel.getByRole('button', { name: 'متابعة السجل' }).waitFor()

    await panel.getByRole('button', { name: 'إشارة إلى زميل' }).click()
    await page.getByPlaceholder('ابحث بالاسم…').fill('فهد')
    await page.getByRole('option', { name: 'فهد المراجع' }).click()
    await panel.getByLabel('تعليق جديد').fill('يرجى مراجعة العنوان قبل الاعتماد')
    await panel.getByRole('button', { name: 'إضافة تعليق' }).click()
    await panel.getByText('يرجى مراجعة العنوان قبل الاعتماد').waitFor()
    await panel.getByText('إشارة إلى: فهد المراجع').waitFor()
    // Commenting follows the record.
    await panel.getByRole('button', { name: 'إلغاء المتابعة' }).waitFor()

    await panel.getByRole('button', { name: 'تعديل الوسوم' }).click()
    await panel.getByLabel('الوسوم مفصولة بفواصل').fill('عاجل، مراجعة')
    await panel.getByRole('button', { name: 'حفظ الوسوم' }).click()
    await panel.getByText('مراجعة', { exact: true }).waitFor()

    const direction = await page.evaluate<string>('document.documentElement.dir')
    assert.equal(direction, 'rtl')
    await page.screenshot({ path: join(await screenshotDir(), 'record-collaboration.png') })

    const inbox = await kit().collaboration.state(
      'ui_samples',
      id,
      await kit().actors.load(colleague.user.id)
    )
    assert.lengthOf(inbox.comments, 1)
    assert.deepEqual(inbox.tags, ['عاجل', 'مراجعة'])
  })

  test('assign a task in a dialog and complete it from my tasks', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(owner.user)
    const page = await visit(`/resources/ui_samples/${id}`)
    const section = page.getByRole('region', { name: 'المهام المسندة' })
    await section.getByRole('button', { name: 'إسناد مهمة' }).click()
    const dialog = page.getByRole('dialog', { name: 'إسناد مهمة' })
    await dialog.getByRole('combobox', { name: 'المكلف' }).click()
    await page.getByRole('option', { name: 'فهد المراجع' }).click()
    await dialog.getByLabel('عنوان المهمة').fill('تدقيق العينة')
    await dialog.getByLabel('تاريخ الاستحقاق').fill('2026-12-31')
    await dialog.getByRole('button', { name: 'إسناد', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await section.getByText('تدقيق العينة').waitFor()
    await section.getByText('31/12/2026', { exact: true }).waitFor()

    await browserContext.clearCookies()
    await browserContext.loginAs(colleague.user)
    const tasks = await visit('/my-tasks')
    await tasks.getByRole('heading', { name: 'مهامي' }).waitFor()
    await tasks.getByText('تدقيق العينة').waitFor()
    // The due date uses the shared calendar formatter, not the raw ISO string (issue #33).
    await tasks.getByText('31/12/2026', { exact: true }).waitFor()
    await tasks.screenshot({ path: join(await screenshotDir(), 'my-tasks.png') })
    await tasks.getByRole('button', { name: 'تم الإنجاز' }).click()
    await tasks.getByText('لا مهام في هذا العرض.').waitFor()
    const [row] = await kit().assignments.forRecord(
      'ui_samples',
      id,
      await kit().actors.load(owner.user.id)
    )
    assert.equal(row.status, 'done')
  })
})
