import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import type { HttpContext } from '@adonisjs/core/http'
import { TwoFactor } from '@adula/kit'
import { identity } from '#services/initial_setup'

/** Session key holding a password-verified user awaiting the second factor. */
export const PENDING_KEY = 'two_factor_pending'
const PENDING_TTL_MS = 5 * 60 * 1000

export async function twoFactor() {
  const brand = await identity()
  return new TwoFactor(
    db.connection().getWriteClient(),
    {
      seal: (value) => encryption.encrypt(value),
      open: (value) => encryption.decrypt<string>(value),
    },
    brand.company
  )
}

/** Remembers the password-verified user; login completes only after the code. */
export function beginChallenge(ctx: HttpContext, userId: number, method: 'password' | 'oauth') {
  ctx.session.regenerate()
  ctx.session.put(PENDING_KEY, { userId, method, at: Date.now() })
}

export function pendingChallenge(ctx: HttpContext) {
  const pending = ctx.session.get(PENDING_KEY) as
    { userId: number; method: 'password' | 'oauth'; at: number } | undefined
  if (!pending || !Number.isSafeInteger(pending.userId) || Date.now() - pending.at > PENDING_TTL_MS)
    return null
  return pending
}
