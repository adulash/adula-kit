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

test.group('CSV import browser acceptance', (group) => {
  let clerk: UiActor
  group.setup(async () => {
    clerk = await seedActor([{ subject: 'all', action: 'manage' }], { fullName: 'مستورد العينات' })
    await installSampleResources()
    return () => removeSampleResources()
  })

  test('upload a CSV, map a column and follow the batch to completion', async ({
    browserContext,
    visit,
  }) => {
    await browserContext.loginAs(clerk.user)
    const page = await visit('/resources/ui_samples')
    await page.getByRole('button', { name: 'استيراد CSV' }).click()
    const dialog = page.getByRole('dialog', { name: 'استيراد إلى عينات الواجهة' })
    await dialog.getByLabel('الملف').setInputFiles({
      name: 'samples.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`البيان,الوحدة\nمن المتصفح,${clerk.orgUnitId}\n`),
    })
    await dialog.getByRole('button', { name: 'رفع الملف' }).click()
    await dialog.getByRole('combobox', { name: 'حقل العمود البيان' }).click()
    await page.getByRole('option', { name: 'العنوان *' }).click()
    await dialog.getByRole('combobox', { name: 'حقل العمود الوحدة' }).click()
    await page.getByRole('option', { name: 'الوحدة التنظيمية (رقم) *' }).click()
    await dialog.getByRole('button', { name: 'بدء الاستيراد' }).click()
    await page.waitForURL(/\/imports$/)
    await page.getByText('samples.csv').waitFor()
    await kit().imports.process()
    await page.getByText('نجح 1').waitFor({ timeout: 10000 })
    await page.screenshot({ path: join(await screenshotDir(), 'imports.png') })
  })
})
