import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { Secret, TOTP } from 'otpauth'
import User from '#models/user'
import limiter from '@adonisjs/limiter/services/main'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()
const code = (secret: string, offsetSteps = 0) =>
  new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({
    timestamp: Date.now() + offsetSteps * 30000,
  })

test.group('Two-factor authentication over HTTP', (group) => {
  let user: User
  let secret: string
  let recovery: string[]
  const password = 'two-factor-test-password-123'
  group.setup(async () => {
    user = await User.create({
      fullName: 'مستخدم الحماية',
      email: `twofactor-${Date.now()}@example.test`,
      password,
    })
  })
  group.each.setup(async () => {
    // Login throttles are shared with the rest of the suite; start each test clean.
    await limiter.clear()
  })

  test('enrollment requires a valid code and returns recovery codes once', async ({
    client,
    assert,
  }) => {
    const begin = await client
      .post('/account/two-factor')
      .loginAs(user)
      .withCsrfToken()
      .headers(json)
    begin.assertStatus(200)
    secret = begin.body().data.secret
    const wrong = await client
      .post('/account/two-factor/confirm')
      .loginAs(user)
      .withCsrfToken()
      .headers(json)
      .json({ code: '123456' })
    wrong.assertStatus(422)
    const confirmed = await client
      .post('/account/two-factor/confirm')
      .loginAs(user)
      .withCsrfToken()
      .headers(json)
      .json({ code: code(secret, -1) })
    confirmed.assertStatus(200)
    recovery = confirmed.body().data.recoveryCodes
    assert.lengthOf(recovery, 10)
    const activity = await knex()('activities')
      .where({ resource: 'users', record_id: user.id, action: 'two_factor_enabled' })
      .first()
    assert.exists(activity)
  })

  test('the password alone no longer signs in; the code completes the login', async ({
    client,
    assert,
  }) => {
    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .form({ email: user.email, password })
    login.assertStatus(302)
    assert.equal(login.header('location'), '/login/two-factor')
    // Not signed in yet: protected pages still redirect to login.
    const blocked = await client
      .get('/my-tasks')
      .withCsrfToken()
      .withSession(login.session())
      .redirects(0)
    assert.equal(blocked.header('location'), '/login')

    const wrong = await client
      .post('/login/two-factor')
      .withCsrfToken()
      .withSession(login.session())
      .redirects(0)
      .form({ code: '000000' })
    assert.equal(wrong.header('location'), '/login/two-factor')
    const ok = await client
      .post('/login/two-factor')
      .withCsrfToken()
      .withSession(login.session())
      .redirects(0)
      .form({ code: code(secret) })
    ok.assertStatus(302)
    assert.equal(ok.header('location'), '/')
    const replay = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .form({ email: user.email, password })
    const replayed = await client
      .post('/login/two-factor')
      .withCsrfToken()
      .withSession(replay.session())
      .redirects(0)
      .form({ code: code(secret) })
    assert.equal(replayed.header('location'), '/login/two-factor')
  })

  test('a recovery code works once and attempts are rate limited', async ({ client, assert }) => {
    const first = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .form({ email: user.email, password })
    const used = await client
      .post('/login/two-factor')
      .withCsrfToken()
      .withSession(first.session())
      .redirects(0)
      .form({ code: recovery[0] })
    assert.equal(used.header('location'), '/')
    const second = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .form({ email: user.email, password })
    for (let attempt = 0; attempt < 5; attempt++)
      await client
        .post('/login/two-factor')
        .withCsrfToken()
        .withSession(second.session())
        .redirects(0)
        .form({ code: recovery[0] })
    // Even a valid code is refused while the account is blocked.
    const locked = await client
      .post('/login/two-factor')
      .withCsrfToken()
      .withSession(second.session())
      .header('Accept', 'application/json')
      .json({ code: recovery[1] })
    locked.assertStatus(401)
    assert.include(locked.body().errors[0].message, 'انتظر')
  })

  test('disabling needs the password and a code', async ({ client }) => {
    const noPassword = await client
      .post('/account/two-factor/disable')
      .loginAs(user)
      .withCsrfToken()
      .headers(json)
      .json({ password: 'wrong', code: recovery[2] })
    noPassword.assertStatus(422)
    const done = await client
      .post('/account/two-factor/disable')
      .loginAs(user)
      .withCsrfToken()
      .headers(json)
      .json({ password, code: recovery[2] })
    done.assertStatus(200)
    const plain = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .form({ email: user.email, password })
    plain.assertStatus(302)
    if (plain.header('location') !== '/') throw new Error('Login should complete without 2FA')
  })
})
