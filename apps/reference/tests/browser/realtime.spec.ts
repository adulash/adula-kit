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

  test('a hidden tab releases its stream and catches up when it becomes visible', async ({
    browserContext,
  }) => {
    await db.from('notifications').where('user_id', member.user.id).delete()
    await browserContext.loginAs(member.user)
    const page = await browserContext.newPage()
    // Track every EventSource the page opens.
    await page.addInitScript(`{
      const Native = window.EventSource
      window.__streams = []
      window.EventSource = class extends Native {
        constructor(...args) { super(...args); window.__streams.push(this) }
      }
    }`)
    const subscribed = page.waitForResponse(
      (response) => response.url().includes('/__transmit/subscribe') && response.ok()
    )
    await page.goto('/notifications')
    await subscribed
    const visibility = (state: 'hidden' | 'visible') =>
      page.evaluate(`{
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => '${state}' })
        document.dispatchEvent(new Event('visibilitychange'))
      }`)
    // The page CSP forbids string evaluation inside waitForFunction; poll through evaluate.
    const until = async (condition: string) => {
      for (const started = Date.now(); Date.now() - started < 20_000;) {
        if (await page.evaluate<boolean>(condition)) return
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error(`Timed out waiting for ${condition}`)
    }
    // Browsers allow six HTTP/1.1 connections per host; hidden tabs must not hold one (#36).
    await visibility('hidden')
    await until('window.__streams.length === 1 && window.__streams[0].readyState === 2')
    await notifyWithTemplate(
      db.connection().getWriteClient(),
      member.user.id,
      'assignment.created',
      {
        title: 'أثناء الإخفاء',
        resource: 'الطلبات',
        id: 1,
      }
    )
    await visibility('visible')
    await page.getByTestId('unread-count').filter({ hasText: '1' }).waitFor()
    await until('window.__streams.length === 2 && window.__streams[1].readyState !== 2')
  })
})
