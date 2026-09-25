import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { notifyWithTemplate } from '@adula/kit'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

test.group('Realtime notification bell', (group) => {
  let member: UiActor
  let other: UiActor
  group.setup(async () => {
    member = await seedActor([{ subject: 'customers', action: 'view' }], {
      fullName: 'متلقي الإشعارات',
      level: 0,
    })
    other = await seedActor([{ subject: 'customers', action: 'view' }], {
      fullName: 'مستخدم آخر',
      level: 0,
    })
  })

  test('a committed notification updates the bell without a page reload', async ({
    browserContext,
  }) => {
    await browserContext.loginAs(member.user)
    const page = await browserContext.newPage()
    // Registered before navigation so the accepted subscription cannot be missed.
    const subscribed = page.waitForResponse(
      (response) => response.url().includes('/__transmit/subscribe') && response.ok()
    )
    await page.goto('/notifications')
    await page.getByRole('heading', { name: 'الإشعارات' }).waitFor()
    await subscribed
    const knex = db.connection().getWriteClient()
    // Another user's notification must not reach this tab.
    await notifyWithTemplate(knex, other.user.id, 'comment.created', { author: 'x' })
    await notifyWithTemplate(knex, member.user.id, 'assignment.created', {
      title: 'مراجعة فورية',
      resource: 'الطلبات',
      id: 1,
    })
    await page.getByText('وصلك إشعار جديد').waitFor()
    await page.getByTestId('unread-count').filter({ hasText: '1' }).waitFor()
  })
})
