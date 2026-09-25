import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { logAuthActivity, requestContext } from '#services/auth_activity'
import { recordSession } from '#services/sessions'
import { PENDING_KEY, pendingChallenge, twoFactor } from '#services/two_factor'
import { twoFactorAccountLimiter } from '#start/limiter'

class InvalidSecondFactor extends Error {}

/** Second login step: a TOTP or recovery code for a password-verified user. */
export default class TwoFactorChallengeController {
  async create(ctx: HttpContext) {
    if (!pendingChallenge(ctx)) return ctx.response.redirect().toPath('/login')
    return ctx.inertia.render('auth/two_factor', {})
  }

  async store(ctx: HttpContext) {
    const pending = pendingChallenge(ctx)
    if (!pending) {
      ctx.session.forget(PENDING_KEY)
      return this.refuse(ctx, 'انتهت مهلة التحقق. سجّل الدخول مجدداً.', '/login')
    }
    const user = await User.find(pending.userId)
    if (!user || user.disabledAt) {
      ctx.session.forget(PENDING_KEY)
      return this.refuse(ctx, 'تعذر إكمال الدخول.', '/login')
    }
    const service = await twoFactor()
    const code = String(ctx.request.input('code') ?? '')
    let result: 'totp' | 'recovery' | null = null
    try {
      const [blocked, verified] = await twoFactorAccountLimiter.penalize(
        `two_factor:${user.id}`,
        async () => {
          const outcome = await service.verify(user.id, code)
          if (!outcome) throw new InvalidSecondFactor()
          return outcome
        }
      )
      if (blocked)
        return this.refuse(
          ctx,
          'محاولات كثيرة. انتظر ربع ساعة ثم حاول مجدداً.',
          '/login/two-factor'
        )
      result = verified
    } catch (error) {
      if (!(error instanceof InvalidSecondFactor)) throw error
    }
    if (!result) {
      await logAuthActivity({
        userId: user.id,
        action: 'two_factor_failed',
        changes: requestContext(ctx),
      })
      return this.refuse(ctx, 'رمز التحقق غير صحيح', '/login/two-factor')
    }
    ctx.session.forget(PENDING_KEY)
    await ctx.auth.use('web').login(user)
    await recordSession(ctx, user.id)
    if (result === 'recovery')
      await logAuthActivity({
        userId: user.id,
        action: 'two_factor_recovery_used',
        changes: requestContext(ctx),
      })
    await logAuthActivity({
      userId: user.id,
      action: pending.method === 'oauth' ? 'oauth_login' : 'login',
      changes: { ...requestContext(ctx), secondFactor: result },
    })
    return ctx.response.redirect().toRoute('home')
  }

  private refuse(
    { request, response, session }: HttpContext,
    message: string,
    path: '/login' | '/login/two-factor'
  ) {
    if (request.accepts(['html', 'json']) === 'json')
      return response.unauthorized({ errors: [{ message }] })
    session.flash('inputErrorsBag', { code: [message] })
    return response.redirect().toPath(path)
  }
}
