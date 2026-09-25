/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Authentication endpoints are
| keyed by IP (login also by e-mail); resource and MCP endpoints by user.
|
*/

import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'

const message = 'محاولات كثيرة في وقت قصير. انتظر دقيقة ثم حاول مجدداً.'
const withMessage = (error: { setMessage(value: string): unknown }) => {
  error.setMessage(message)
}
const emailOf = (ctx: HttpContext) =>
  String(ctx.request.input('email', '') ?? '')
    .trim()
    .toLowerCase()

/** Login: 5 attempts per minute for one e-mail from one address. */
export const loginThrottle = limiter.define('login', (ctx) =>
  limiter
    .allowRequests(5)
    .every('1 minute')
    .usingKey(`${ctx.request.ip()}:${emailOf(ctx)}`)
    .limitExceeded(withMessage)
)

/**
 * Login attempts per minute from one address across all e-mails (password spraying).
 * Offices behind one public address share it, so it stays well above a team's
 * morning sign-in; per-account lockout below limits guessing independently.
 */
export const LOGIN_ADDRESS_LIMIT = env.get('LOGIN_ADDRESS_LIMIT', 100)
export const loginAddressThrottle = limiter.define('login_address', (ctx) =>
  limiter
    .allowRequests(LOGIN_ADDRESS_LIMIT)
    .every('1 minute')
    .usingKey(ctx.request.ip())
    .limitExceeded(withMessage)
)

/**
 * Login: failed attempts per account from any address. Only failures count and a
 * success clears the counter; the controller applies it with `penalize`.
 */
export const loginAccountLimiter = limiter.use({
  requests: 10,
  duration: '15 minutes',
  blockDuration: '15 minutes',
})

/** Password change: 5 attempts per minute per signed-in user. */
export const passwordChangeThrottle = limiter.define('password_change', (ctx) =>
  limiter
    .allowRequests(5)
    .every('1 minute')
    .usingKey(`user:${ctx.auth.user?.id ?? ctx.request.ip()}`)
    .limitExceeded(withMessage)
)

/** Signup: 3 accounts per minute per address. */
export const signupThrottle = limiter.define('signup', (ctx) =>
  limiter.allowRequests(3).every('1 minute').usingKey(ctx.request.ip()).limitExceeded(withMessage)
)

/** Recovery (forgot + reset): 3 submissions per minute per address. */
export const passwordThrottle = limiter.define('password', (ctx) =>
  limiter.allowRequests(3).every('1 minute').usingKey(ctx.request.ip()).limitExceeded(withMessage)
)

/** OAuth redirects and callbacks: 10 per minute per address. */
export const oauthThrottle = limiter.define('oauth', (ctx) =>
  limiter.allowRequests(10).every('1 minute').usingKey(ctx.request.ip()).limitExceeded(withMessage)
)

/** Resource and MCP routes: 300 requests per minute per authenticated user. */
export const apiThrottle = limiter.define('api', (ctx) =>
  limiter
    .allowRequests(300)
    .every('1 minute')
    .usingKey(ctx.auth.user ? `user:${ctx.auth.user.id}` : `ip:${ctx.request.ip()}`)
    .limitExceeded(withMessage)
)

/** Second-factor attempts per account: failures only, cleared by a success. */
export const twoFactorAccountLimiter = limiter.use({
  requests: 5,
  duration: '15 minutes',
  blockDuration: '15 minutes',
})
