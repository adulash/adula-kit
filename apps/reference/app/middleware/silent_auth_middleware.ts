import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { ensureSessionActive } from '#services/sessions'
import { endImpersonation } from '#services/impersonation'

/**
 * Silent auth middleware can be used as a global middleware to silent check
 * if the user is logged-in or not.
 *
 * The request continues as usual, even when the user is not logged-in. A
 * revoked session or a disabled user is silently signed out.
 */
export default class SilentAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.check()
    if (ctx.auth.isAuthenticated) {
      const state = await ensureSessionActive(ctx)
      if (!state.active) {
        await ctx.auth.use('web').logout()
        endImpersonation(ctx.session)
      }
    }

    return next()
  }
}
