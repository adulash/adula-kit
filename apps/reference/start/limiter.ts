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
