import { test } from '@japa/runner'
import { Secret, TOTP } from 'otpauth'
import { KitError, TwoFactor } from '../index.js'
import type { SecretBox } from '../index.js'
import { db, setup } from './helpers.js'

const box: SecretBox = {
  seal: (value) => `sealed:${Buffer.from(value).toString('base64')}`,
  open: (value) =>
    value.startsWith('sealed:') ? Buffer.from(value.slice(7), 'base64').toString() : null,
}
const code = (secret: string, offsetSteps = 0) =>
  new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({
    timestamp: Date.now() + offsetSteps * 30000,
  })

async function failure(run: () => Promise<unknown>): Promise<KitError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof KitError) return error
    throw error
  }
  throw new Error('Expected a KitError')
}

test.group('TOTP two-factor authentication', (group) => {
  const service = () => new TwoFactor(db, box, 'عدولة')
  group.setup(setup)
  group.each.setup(async () => {
    await db('user_two_factor').del()
  })

  test('enrolls with a sealed secret and confirms with a current code', async ({ assert }) => {
    const enrollment = await service().begin(1, 'admin@example.test')
    assert.match(enrollment.otpauthUrl, /^otpauth:\/\/totp\//)
    assert.include(enrollment.otpauthUrl, 'issuer=')
    const [row] = await db('user_two_factor').where('user_id', 1)
    assert.notInclude(row.secret, enrollment.secret)
    const wrong = await failure(() => service().confirm(1, '000000'))
    assert.equal(wrong.code, 'E_2FA_CODE')
    assert.isFalse(await service().enabled(1))
    const recovery = await service().confirm(1, code(enrollment.secret))
    assert.lengthOf(recovery, 10)
    assert.isTrue(await service().enabled(1))
    const [stored] = await db('user_two_factor').where('user_id', 1)
    assert.notInclude(JSON.stringify(stored.recovery_codes), recovery[0])
    const again = await failure(() => service().begin(1, 'admin@example.test'))
    assert.equal(again.code, 'E_2FA_ENABLED')
  })

  test('a time step is accepted once and stale or malformed codes fail', async ({ assert }) => {
    const { secret } = await service().begin(1, 'a')
    await service().confirm(1, code(secret, -1))
    // The confirming step (previous) cannot be replayed; the current step still works once.
    assert.isFalse(await service().verify(1, code(secret, -1)))
    assert.equal(await service().verify(1, code(secret)), 'totp')
    assert.isFalse(await service().verify(1, code(secret)))
    assert.isFalse(await service().verify(1, code(secret, -5)))
    assert.isFalse(await service().verify(1, 'abcdef'))
    assert.isFalse(await service().verify(1, '1'.repeat(64)))
    assert.isFalse(await service().verify(2, code(secret)))
  })

  test('recovery codes are single use and can be regenerated', async ({ assert }) => {
    const { secret } = await service().begin(1, 'a')
    const [first, second] = await service().confirm(1, code(secret))
    assert.equal(await service().verify(1, first.toUpperCase()), 'recovery')
    assert.isFalse(await service().verify(1, first))
    const status = await service().status(1)
    assert.equal(status.recoveryRemaining, 9)
    const fresh = await service().regenerateRecoveryCodes(1)
    assert.isFalse(await service().verify(1, second))
    assert.equal(await service().verify(1, fresh[0]), 'recovery')
    await service().disable(1)
    assert.isFalse(await service().enabled(1))
  })
})
