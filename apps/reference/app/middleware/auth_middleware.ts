import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { ensureSessionActive } from '#services/sessions'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users. It also ends sessions that were
 * revoked and sessions of disabled users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })
    const state = await ensureSessionActive(ctx)
    if (!state.active) {
      await ctx.auth.use('web').logout()
      const message =
        state.reason === 'disabled'
          ? 'هذا الحساب معطّل. تواصل مع مدير النظام.'
          : 'أُنهيت هذه الجلسة. سجّل الدخول مجدداً.'
      if (ctx.request.accepts(['html', 'json']) === 'json')
        return ctx.response.unauthorized({ errors: [{ message }] })
      ctx.session.flash('error', message)
      return ctx.response.redirect().toPath(this.redirectTo)
    }
    return next()
  }
}
