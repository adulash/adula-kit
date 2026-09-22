import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { UserInvitations } from '@adula/kit'
import UserInvitationNotification from '#mails/user_invitation_notification'
import app from '@adonisjs/core/services/app'
import { mkdir } from 'node:fs/promises'

test.group('Administration screens in the browser', (group) => {
  let admin: User
  let member: User
  let roleId: number
  let rootId: number
  let rootPath: string
  let movingId: number
  let targetId: number
  const unique = randomUUID().replaceAll('-', '').slice(0, 10)
  const knex = () => db.connection().getWriteClient()
  const moving = `وحدة النقل ${unique}`

  group.setup(async () => {
    admin = await User.create({
      fullName: 'مدير المتصفح',
      email: `browser-admin-${unique}@example.test`,
      password: 'browser-test-only-password',
    })
    member = await User.create({
      fullName: 'عضو المتصفح',
      email: `browser-member-${unique}@example.test`,
      password: 'browser-test-only-password',
    })
    rootPath = `br${unique}`
    const [root] = await knex()('org_units')
      .insert({ name: 'جذر المتصفح', type: 'root', path: rootPath })
      .returning('id')
    rootId = root.id
    const [source] = await knex()('org_units')
      .insert({ name: moving, type: 'department', path: `${rootPath}.tmp1${unique}` })
      .returning('id')
    movingId = source.id
    await knex()('org_units')
      .where('id', movingId)
      .update({ parent_id: rootId, path: `${rootPath}.${movingId}` })
    const [target] = await knex()('org_units')
      .insert({ name: `الوجهة ${unique}`, type: 'department', path: `${rootPath}.tmp2${unique}` })
      .returning('id')
    targetId = target.id
    await knex()('org_units')
      .where('id', targetId)
      .update({ parent_id: rootId, path: `${rootPath}.${targetId}` })
    const [adminRole] = await knex()('roles')
      .insert({ name: `browser-admin-${unique}`, permission_level: 1 })
      .returning('id')
    await knex()('role_rules').insert({ role_id: adminRole.id, subject: 'all', action: 'manage' })
    await knex()('user_roles').insert({ user_id: admin.id, role_id: adminRole.id })
    await knex()('user_org_units').insert([
      { user_id: admin.id, org_unit_id: rootId },
      { user_id: member.id, org_unit_id: rootId },
    ])
    const [role] = await knex()('roles')
      .insert({ name: `browser-role-${unique}` })
      .returning('id')
    roleId = role.id
    await knex()('user_roles').insert({ user_id: member.id, role_id: roleId })
  })

  test('invitation dialog preserves duplicate errors, sends mail and fits mobile', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const { mails } = mail.fake()
    try {
      await browserContext.loginAs(admin)
      const page = await visit('/admin/users')
      await page.getByRole('link', { name: 'إضافة مستخدم', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('الاسم الكامل').fill('مستخدم الدعوة')
      await dialog.getByLabel('البريد الإلكتروني').fill(member.email)
      await dialog.getByRole('button', { name: 'إرسال الدعوة', exact: true }).click()
      await dialog.getByText('يوجد حساب بهذا البريد بالفعل', { exact: true }).waitFor()
      assert.equal(await dialog.getByLabel('الاسم الكامل').inputValue(), 'مستخدم الدعوة')
      const address = `browser-invited-${randomUUID()}@example.test`
      await dialog.getByLabel('البريد الإلكتروني').fill(address)
      await dialog.getByRole('button', { name: 'إرسال الدعوة', exact: true }).click()
      await page.getByText('تم إرسال الدعوة بالبريد.', { exact: false }).waitFor()
      mails.assertSentCount(UserInvitationNotification, 1)
      assert.isUndefined(await knex()('users').where('email', address).first())
      await page.setViewportSize({ width: 390, height: 844 })
      await dialog.evaluate(
        async (element: { getAnimations(): { finished: Promise<unknown> }[] }) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished))
        }
      )
      await mkdir(app.makePath('../../.work/screenshots'), { recursive: true })
      await page.screenshot({
        path: app.makePath('../../.work/screenshots/invite-mobile.png'),
        fullPage: true,
      })
      const bounds = await dialog.boundingBox()
      assert.isAtLeast(bounds!.x, 12)
      assert.isAtMost(bounds!.x + bounds!.width, 378)
      await dialog.getByLabel('الاسم الكامل').fill('مسودة محفوظة')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'متابعة التحرير', exact: true }).click()
      assert.equal(await dialog.getByLabel('الاسم الكامل').inputValue(), 'مسودة محفوظة')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'إغلاق دون حفظ', exact: true }).click()
      await page.waitForURL('**/admin/users')
    } finally {
      mail.restore()
    }
  })

  test('guest accepts an invitation in a dialog and signs in with the chosen password', async ({
    visit,
    assert,
  }) => {
    let token = ''
    const address = `accepted-${randomUUID()}@example.test`
    await new UserInvitations(knex()).invite(
      admin.id,
      { email: address, fullName: 'المستخدم الجديد' },
      async (invitation) => {
        token = invitation.token
      }
    )
    const page = await visit(`/invitations/${token}`)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('كلمة المرور', { exact: true }).fill('browser-invitation-123')
    await dialog.getByLabel('تأكيد كلمة المرور').fill('different-password')
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/invitations/')
    )
    await dialog.getByRole('button', { name: 'إنشاء حسابي', exact: true }).click()
    const rejection = await rejected
    assert.equal(rejection.status(), 302)
    try {
      await dialog.getByRole('alert').first().waitFor()
    } finally {
      await page.screenshot({
        path: app.makePath('../../.work/screenshots/invitation-validation.png'),
        fullPage: true,
      })
    }
    await dialog.getByLabel('تأكيد كلمة المرور').fill('browser-invitation-123')
    await dialog.getByRole('button', { name: 'إنشاء حسابي', exact: true }).click()
    await page.waitForURL('**/login')
    const authenticated = await User.verifyCredentials(address, 'browser-invitation-123')
    assert.equal(authenticated.fullName, 'المستخدم الجديد')
    const again = await visit(`/invitations/${token}`)
    await again.getByRole('alert').getByText('الدعوة غير صالحة', { exact: false }).waitFor()
    await again.goto('/login')
    await again.getByLabel('البريد الإلكتروني', { exact: true }).fill(address)
    await again.getByLabel('كلمة المرور', { exact: true }).fill('browser-invitation-123')
    await again.getByRole('button', { name: 'دخول', exact: true }).click()
    await again.waitForURL((url) => url.pathname === '/')
  })

  test('initial setup asks for mail receipt and persists the negative response', async ({
    browserContext,
    visit,
    assert,
  }) => {
    mail.fake()
    try {
      await browserContext.loginAs(admin)
      const page = await visit('/admin/setup')
      await page.getByRole('heading', { name: 'الإعداد الأولي', exact: true }).waitFor()
      await page.getByRole('button', { name: 'إرسال بريد تجريبي', exact: true }).click()
      await page
        .getByRole('dialog')
        .getByRole('heading', { name: 'هل وصل البريد التجريبي؟' })
        .waitFor()
      assert.include(await page.getByRole('dialog').innerText(), admin.email)
      await page.getByRole('button', { name: 'لم تصل الرسالة', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'أفاد المدير بعدم وصول الرسالة' }).waitFor()
      await page.reload()
      await page.getByRole('status').filter({ hasText: 'أفاد المدير بعدم وصول الرسالة' }).waitFor()
      assert.equal(await page.getByRole('dialog').count(), 0)
    } finally {
      mail.restore()
    }
  })

  test('setup identity review uses a dialog and requires explicit approval', async ({
    browserContext,
    visit,
  }) => {
    await browserContext.loginAs(admin)
    const page = await visit('/admin/setup')
    await page.getByRole('button', { name: 'مراجعة الهوية', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'أعتمد الهوية الحالية' }).click()
    await page.getByText('اعتمد المدير الهوية الحالية', { exact: true }).waitFor()
    await page.reload()
    await page.getByText('اعتمد المدير الهوية الحالية', { exact: true }).waitFor()
  })

  test('toggling a matrix cell writes the rule and the page reflects it', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin)
    const page = await visit(`/admin/roles/${roleId}`)
    const allow = page.getByRole('button', { name: 'سماح: المهام / عرض', exact: true })
    const deny = page.getByRole('button', { name: 'منع: المهام / عرض', exact: true })
    assert.equal(await allow.getAttribute('aria-pressed'), 'false')
    await allow.click()
    await page.getByRole('button', { name: 'تراجع', exact: true }).click()
    assert.notExists(
      await knex()('role_rules')
        .where({ role_id: roleId, subject: 'tasks', action: 'view', inverted: false })
        .first()
    )
    await allow.click()
    await page.getByRole('button', { name: 'تأكيد التغيير', exact: true }).click()
    await page.locator('button[aria-label="سماح: المهام / عرض"][aria-pressed="true"]').waitFor()
    assert.exists(
      await knex()('role_rules')
        .where({ role_id: roleId, subject: 'tasks', action: 'view', inverted: false })
        .first()
    )
    await deny.click()
    await page.getByRole('button', { name: 'تأكيد التغيير', exact: true }).click()
    await page.locator('button[aria-label="منع: المهام / عرض"][aria-pressed="true"]').waitFor()
    assert.exists(
      await knex()('role_rules')
        .where({ role_id: roleId, subject: 'tasks', action: 'view', inverted: true })
        .first()
    )
    await page.assertElementsCount('tbody tr', 2 + 4 + 1 + 1)
    await allow.click()
    await page.getByRole('button', { name: 'تأكيد حذف الصلاحية', exact: true }).click()
    await page.locator('button[aria-label="سماح: المهام / عرض"][aria-pressed="false"]').waitFor()
    assert.notExists(
      await knex()('role_rules')
        .where({ role_id: roleId, subject: 'tasks', action: 'view', inverted: false })
        .first()
    )
  })

  test('moving an org unit updates its path in the tree', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin)
    const page = await visit('/admin/org-units')
    await page.getByLabel(`نقل ${moving} إلى`, { exact: true }).selectOption(String(targetId))
    await page.getByRole('button', { name: `نقل ${moving}`, exact: true }).click()
    const path = `${rootPath}.${targetId}.${movingId}`
    await page.getByText(path, { exact: true }).waitFor()
    const row = await knex()('org_units').where('id', movingId).first()
    assert.equal(String(row.path), path)
    assert.equal(row.parent_id, targetId)
  })

  test('own administrator grant requires confirmation and cannot be removed', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin)
    const assignment = await knex()('user_roles').where('user_id', admin.id).first()
    const page = await visit(`/admin/roles/${assignment.role_id}`)
    await page.getByRole('button', { name: /^تفاصيل قاعدة/ }).click()
    await page.getByRole('dialog').waitFor()
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 4, y: 4 } })
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: /^حذف قاعدة/ }).click()
    await page.getByRole('button', { name: 'تأكيد حذف الصلاحية', exact: true }).click()
    await page
      .getByText(/لا يمكنك إزالة صلاحية إدارة النظام من حسابك الحالي|سيزيل آخر مدير نشط للنظام/)
      .waitFor()
    assert.exists(
      await knex()('role_rules')
        .where({ role_id: assignment.role_id, subject: 'all', action: 'manage', inverted: false })
        .first()
    )
    await page.getByRole('link', { name: 'المستخدمون', exact: true }).click()
    await page.getByRole('heading', { name: 'المستخدمون', exact: true }).waitFor()
  })

  test('authenticated navigation preserves the workspace and honors reduced motion', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin)
    const page = await visit('/')
    await page.locator('[data-workspace-shell]').waitFor()
    await page.evaluate('window.__testShell = document.querySelector("[data-workspace-shell]")')
    await page.getByRole('link', { name: 'الأدوار والصلاحيات', exact: true }).click()
    await page.getByRole('heading', { name: 'الأدوار والصلاحيات', exact: true }).waitFor()
    assert.isTrue(
      await page.evaluate<boolean>(
        'window.__testShell === document.querySelector("[data-workspace-shell]")'
      )
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(
      await page.evaluate<string>(
        'getComputedStyle(document.querySelector(".adula-page-enter")).animationName'
      ),
      'none'
    )
  })

  test('the bell shows the unread count and clears after mark-all-read', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await knex()('notifications').insert([
      { user_id: member.id, title: 'تنبيه أول', body: 'نص الإشعار' },
      { user_id: member.id, title: 'تنبيه ثانٍ', body: 'نص الإشعار' },
    ])
    await browserContext.loginAs(member)
    const page = await visit('/notifications')
    assert.equal(await page.getByTestId('unread-count').textContent(), '2')
    await page.getByRole('button', { name: 'تعيين الكل كمقروء', exact: true }).click()
    await page.getByTestId('unread-count').waitFor({ state: 'detached' })
    await page.getByText('لا إشعارات غير مقروءة', { exact: true }).waitFor()
    const unread = await knex()('notifications').where({ user_id: member.id }).whereNull('read_at')
    assert.lengthOf(unread, 0)
  })

  test('impersonation switches the session and can be ended', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(admin)
    const page = await visit(`/admin/users/${member.id}`)
    await page.getByRole('button', { name: 'انتحال الحساب', exact: true }).click()
    await page.getByText(`أنت تتصفح باسم ${member.fullName}`).waitFor()
    assert.equal(await page.getByRole('link', { name: 'المستخدمون', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'إنهاء الانتحال', exact: true }).click()
    await page.waitForURL(`**/admin/users/${member.id}`)
    await page.getByRole('heading', { name: member.fullName!, exact: true }).waitFor()
    assert.equal(await page.getByText('أنت تتصفح باسم').count(), 0)
    const log = await knex()('activities')
      .where({ resource: 'core.users', record_id: member.id })
      .whereIn('action', ['impersonate', 'stop_impersonation'])
    assert.lengthOf(log, 2)
  })
})
