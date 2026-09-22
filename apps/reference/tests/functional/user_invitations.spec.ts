import { test } from '@japa/runner'
import { createHash, randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { SMTPTransport } from '@adonisjs/mail/transports/smtp'
import limiter from '@adonisjs/limiter/services/main'
import { UserInvitations } from '@adula/kit'
import User from '#models/user'
import UserInvitationNotification from '#mails/user_invitation_notification'
import { smtpSink } from '../helpers/smtp.js'

const knex = () => db.connection().getWriteClient()
const email = () => `invite-${randomUUID()}@example.test`
const password = 'invitation-password-123'

test.group('Core user invitations', (group) => {
  let admin: User
  let member: User
  let delegated: User
  let delegateRole: number
  group.setup(async () => {
    const version = await knex().raw('SHOW server_version_num')
    if (
      Number(version.rows[0].server_version_num) < 170000 ||
      Number(version.rows[0].server_version_num) >= 180000
    )
      throw new Error('Invitation authorization tests require PostgreSQL 17')
    admin = await User.create({ email: email(), password })
    member = await User.create({ email: email(), password })
    delegated = await User.create({ email: email(), password })
    for (const [user, subject, action] of [
      [admin, 'all', 'manage'],
      [delegated, 'core.users', 'invite'],
    ] as const) {
      const [role] = await knex()('roles')
        .insert({ name: `invite-${randomUUID()}` })
        .returning('id')
      await knex()('role_rules').insert({ role_id: role.id, subject, action })
      await knex()('user_roles').insert({ role_id: role.id, user_id: user.id })
      if (user === delegated) delegateRole = role.id
    }
  })
  group.each.setup(async () => {
    await limiter.clear(['memory'])
  })

  test('administrator configures delegation; plain users, scoped roles and explicit denies are refused', async ({
    client,
    assert,
  }) => {
    const before = await knex()('user_invitations').count('* as count').first()
    for (const method of ['get', 'post'] as const) {
      const denied = await client[method]('/users/invite')
        .loginAs(member)
        .withCsrfToken()
        .header('Accept', 'application/json')
      denied.assertStatus(403)
    }
    const anonymous = await client
      .post('/users/invite')
      .withCsrfToken()
      .header('Accept', 'application/json')
    anonymous.assertStatus(401)
    const noCsrf = await client
      .post('/users/invite')
      .loginAs(admin)
      .header('Accept', 'application/json')
    noCsrf.assertStatus(403)
    const rule = await client
      .put(`/admin/roles/${delegateRole}/rules`)
      .loginAs(admin)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ subject: 'core.users', action: 'invite' })
    rule.assertStatus(200)
    const adminDenied = await client
      .get('/admin/users')
      .loginAs(delegated)
      .header('Accept', 'application/json')
    adminDenied.assertStatus(403)
    const page = await client.get('/users/invite').loginAs(delegated).withInertia()
    page.assertStatus(200)
    assert.isTrue(page.body().props.canInviteUsers)
    const [deny] = await knex()('role_rules')
      .insert({ role_id: delegateRole, subject: 'core.users', action: 'invite', inverted: true })
      .returning('id')
    assert.isFalse(await new UserInvitations(knex()).canInvite(delegated.id))
    await knex()('role_rules').where('id', deny.id).delete()
    const [org] = await knex()('org_units')
      .insert({ name: 'نطاق الدعوة', type: 'root', path: `i${randomUUID().replaceAll('-', '')}` })
      .returning('id')
    await knex()('user_roles')
      .where({ user_id: delegated.id, role_id: delegateRole })
      .update({ org_unit_id: org.id })
    assert.isFalse(await new UserInvitations(knex()).canInvite(delegated.id))
    await knex()('user_roles')
      .where({ user_id: delegated.id, role_id: delegateRole })
      .update({ org_unit_id: null })
    const after = await knex()('user_invitations').count('* as count').first()
    assert.equal(after!.count, before!.count)
  })

  test('delegated invite sends a hashed single-use token, creates no account until acceptance and grants no role', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    try {
      const address = email()
      const sent = await client
        .post('/users/invite')
        .loginAs(delegated)
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({
          email: address.toUpperCase(),
          fullName: 'مستخدم مدعو',
          roleId: delegateRole,
          password: 'attacker-password',
        })
      sent.assertStatus(200)
      assert.notProperty(sent.body().data, 'token')
      const createdAudit = await knex()('activities').where({
        resource: 'core.user_invitations',
        record_id: sent.body().data.id,
        action: 'invitation_created',
      })
      assert.lengthOf(createdAudit, 1)
      assert.equal(createdAudit[0].actor_id, delegated.id)
      assert.isUndefined(await knex()('users').where({ email: address }).first())
      const [notification] = mails.sent(
        (entry) => entry instanceof UserInvitationNotification
      ) as UserInvitationNotification[]
      const token = notification.invitationUrl.split('/').pop()!
      const row = await knex()('user_invitations').where({ email: address }).first()
      assert.equal(row.token_hash, createHash('sha256').update(token).digest('hex'))
      assert.closeTo(new Date(row.expires_at).getTime(), Date.now() + 86400000, 60000)
      const view = await client.get(`/invitations/${token}`).withInertia()
      assert.isTrue(view.body().props.valid)
      const invalidPassword = await client
        .post(`/invitations/${token}`)
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({ password, passwordConfirmation: 'different' })
      invalidPassword.assertStatus(422)
      const responses = await Promise.all(
        [1, 2].map(() =>
          client
            .post(`/invitations/${token}`)
            .withCsrfToken()
            .header('Accept', 'application/json')
            .json({
              password,
              passwordConfirmation: password,
              roleId: delegateRole,
              email: member.email,
            })
        )
      )
      assert.deepEqual(responses.map((response) => response.status()).sort(), [200, 422])
      const user = await User.findByOrFail('email', address)
      assert.equal(user.fullName, 'مستخدم مدعو')
      assert.lengthOf(await knex()('user_roles').where('user_id', user.id), 0)
      const authenticated = await User.verifyCredentials(address, password)
      assert.equal(authenticated.id, user.id)
      assert.isFalse(await new UserInvitations(knex()).valid(token))
      const audit = await knex()('activities').where({
        resource: 'core.users',
        action: 'invitation_accepted',
        record_id: user.id,
      })
      assert.lengthOf(audit, 1)
      assert.notInclude(JSON.stringify(audit), token)
    } finally {
      mail.restore()
    }
  })

  test('resends invalidate old links; expiration, existing accounts and delivery failures are recoverable', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const address = email()
    const send = () =>
      client
        .post('/users/invite')
        .loginAs(admin)
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({ email: address, fullName: 'إعادة إرسال' })
    try {
      const initial = await send()
      initial.assertStatus(200)
      const tooSoon = await send()
      tooSoon.assertStatus(429)
      const tokenAt = (index: number) =>
        (
          mails.sent((entry) => entry instanceof UserInvitationNotification)[
            index
          ] as UserInvitationNotification
        ).invitationUrl
          .split('/')
          .pop()!
      const first = tokenAt(0)
      await knex()('user_invitations')
        .where({ email: address })
        .update({ created_at: new Date(Date.now() - 61000) })
      const resent = await send()
      resent.assertStatus(200)
      const second = tokenAt(1)
      assert.isFalse(await new UserInvitations(knex()).valid(first))
      assert.isTrue(await new UserInvitations(knex()).valid(second))
      await knex()('user_invitations')
        .where({ email: address })
        .update({ expires_at: new Date(Date.now() - 1) })
      const expired = await client
        .post(`/invitations/${second}`)
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({ password, passwordConfirmation: password })
      expired.assertStatus(422)
      const duplicate = await client
        .post('/users/invite')
        .loginAs(admin)
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({ email: member.email.toUpperCase(), fullName: 'موجود' })
      duplicate.assertStatus(409)
    } finally {
      mail.restore()
    }
    const failedEmail = email()
    let failedToken = ''
    await assert.rejects(
      () =>
        new UserInvitations(knex()).invite(
          admin.id,
          { email: failedEmail, fullName: 'فشل البريد' },
          async ({ token }) => {
            failedToken = token
            throw new Error('SMTP rejected')
          }
        ),
      /تعذر إرسال/
    )
    assert.isFalse(await new UserInvitations(knex()).valid(failedToken))
    assert.isUndefined(await knex()('users').where({ email: failedEmail }).first())
    await new UserInvitations(knex()).invite(
      admin.id,
      { email: failedEmail, fullName: 'إعادة المحاولة' },
      async () => {}
    )
  })

  test('invitation travels through the real SMTP transport to a loopback recipient', async ({
    client,
    assert,
  }) => {
    const sink = await smtpSink()
    const previous = mail.config.mailers.smtp
    try {
      await mail.close('smtp')
      mail.config.mailers.smtp = () =>
        new SMTPTransport({ host: '127.0.0.1', port: sink.port, secure: false, ignoreTLS: true })
      const address = email()
      const sent = await client
        .post('/users/invite')
        .loginAs(admin)
        .withCsrfToken()
        .header('Accept', 'application/json')
        .json({ email: address, fullName: 'اختبار البريد' })
      sent.assertStatus(200)
      assert.lengthOf(sink.messages, 1)
      assert.include(sink.messages[0], address)
      const [headers, ...body] = sink.messages[0].split('\r\n\r\n')
      assert.match(headers, /Content-Transfer-Encoding: base64/i)
      const decoded = Buffer.from(body.join('\r\n\r\n'), 'base64').toString('utf8')
      assert.include(decoded, '/invitations/')
      assert.include(decoded, '24 ساعة')
    } finally {
      await mail.close('smtp')
      mail.config.mailers.smtp = previous
      await sink.close()
    }
  })
})
