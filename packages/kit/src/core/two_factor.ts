import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Knex } from 'knex'
import { Secret, TOTP } from 'otpauth'
import { KitError } from '../admin/errors.js'
import type { SecretBox } from '../integrations/webhooks.js'

export type TwoFactorStatus = { enabled: boolean; pending: boolean; recoveryRemaining: number }
export type TwoFactorEnrollment = { otpauthUrl: string; secret: string }

const RECOVERY_CODES = 10
const PERIOD = 30
const WINDOW = 1

const hashCode = (code: string) =>
  createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex')

function recoveryCode() {
  const raw = randomBytes(6).toString('hex')
  return `${raw.slice(0, 6)}-${raw.slice(6)}`
}

/**
 * TOTP two-factor authentication (RFC 6238, SHA-1, 6 digits, 30 s, ±1 step).
 * Secrets are sealed at rest; a used time step cannot be replayed; recovery codes
 * are single-use and stored as SHA-256 hashes. Hosts must require the password
 * (and a current code) before disabling, and rate-limit verification attempts.
 */
export class TwoFactor {
  constructor(
    private db: Knex,
    private secrets: SecretBox,
    private issuer: string
  ) {}

  async status(userId: number): Promise<TwoFactorStatus> {
    const row = await this.db('user_two_factor').where('user_id', userId).first()
    return {
      enabled: Boolean(row?.enabled_at),
      pending: Boolean(row && !row.enabled_at),
      recoveryRemaining: row?.enabled_at ? (row.recovery_codes as string[]).length : 0,
    }
  }

  async enabled(userId: number) {
    const status = await this.status(userId)
    return status.enabled
  }

  /** Starts (or restarts) enrollment with a fresh secret; refused while enabled. */
  async begin(userId: number, account: string): Promise<TwoFactorEnrollment> {
    const existing = await this.db('user_two_factor').where('user_id', userId).first()
    if (existing?.enabled_at)
      throw new KitError(409, 'E_2FA_ENABLED', 'التحقق الثنائي مفعّل بالفعل')
    const secret = new Secret({ size: 20 })
    await this.db('user_two_factor')
      .insert({
        user_id: userId,
        secret: this.secrets.seal(secret.base32),
        recovery_codes: JSON.stringify([]),
        last_used_step: null,
        enabled_at: null,
      })
      .onConflict('user_id')
      .merge(['secret', 'recovery_codes', 'last_used_step', 'enabled_at'])
    return { otpauthUrl: this.totp(secret.base32, account).toString(), secret: secret.base32 }
  }

  /** Confirms enrollment with a current code and returns the one-time recovery codes. */
  async confirm(userId: number, code: unknown): Promise<string[]> {
    return this.db.transaction(async (trx) => {
      const row = await trx('user_two_factor').where('user_id', userId).forUpdate().first()
      if (!row || row.enabled_at) throw new KitError(409, 'E_2FA_STATE', 'ابدأ التفعيل أولاً')
      const step = this.match(this.open(row.secret), code)
      if (step === null) throw new KitError(422, 'E_2FA_CODE', 'رمز التحقق غير صحيح')
      const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode)
      await trx('user_two_factor')
        .where('user_id', userId)
        .update({
          enabled_at: trx.fn.now(),
          last_used_step: step,
          recovery_codes: JSON.stringify(codes.map(hashCode)),
        })
      return codes
    })
  }

  /**
   * Verifies a TOTP code or consumes a recovery code. A time step is accepted
   * once, so an intercepted code cannot be replayed within its window.
   */
  async verify(userId: number, code: unknown): Promise<'totp' | 'recovery' | false> {
    if (typeof code !== 'string' || code.length > 32) return false
    return this.db.transaction(async (trx) => {
      const row = await trx('user_two_factor').where('user_id', userId).forUpdate().first()
      if (!row?.enabled_at) return false
      const step = this.match(this.open(row.secret), code)
      if (step !== null) {
        if (row.last_used_step !== null && step <= Number(row.last_used_step)) return false
        await trx('user_two_factor').where('user_id', userId).update({ last_used_step: step })
        return 'totp'
      }
      const hashed = Buffer.from(hashCode(code), 'hex')
      const remaining = row.recovery_codes as string[]
      const index = remaining.findIndex((stored) =>
        timingSafeEqual(Buffer.from(stored, 'hex'), hashed)
      )
      if (index === -1) return false
      await trx('user_two_factor')
        .where('user_id', userId)
        .update({
          recovery_codes: JSON.stringify(remaining.filter((_, position) => position !== index)),
        })
      return 'recovery'
    })
  }

  /** Replaces all recovery codes; callers verify a current code first. */
  async regenerateRecoveryCodes(userId: number) {
    const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode)
    const updated = await this.db('user_two_factor')
      .where('user_id', userId)
      .whereNotNull('enabled_at')
      .update({ recovery_codes: JSON.stringify(codes.map(hashCode)) })
    if (!updated) throw new KitError(409, 'E_2FA_STATE', 'التحقق الثنائي غير مفعّل')
    return codes
  }

  async disable(userId: number) {
    await this.db('user_two_factor').where('user_id', userId).del()
  }

  private totp(secret: string, account: string) {
    return new TOTP({
      issuer: this.issuer,
      label: account,
      algorithm: 'SHA1',
      digits: 6,
      period: PERIOD,
      secret: Secret.fromBase32(secret),
    })
  }

  private open(sealed: string) {
    const secret = this.secrets.open(sealed)
    if (!secret) throw new Error('Two-factor secret cannot be opened with the current key')
    return secret
  }

  /** The absolute time step of a valid code, or null. */
  private match(secret: string, code: unknown) {
    if (typeof code !== 'string') return null
    const token = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(token)) return null
    const delta = this.totp(secret, 'x').validate({ token, window: WINDOW })
    if (delta === null) return null
    return Math.floor(Date.now() / 1000 / PERIOD) + delta
  }
}
