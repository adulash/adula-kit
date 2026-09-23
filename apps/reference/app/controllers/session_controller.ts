import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import { logAuthActivity, requestContext } from '#services/auth_activity'
import { endSession, recordSession } from '#services/sessions'
import { socialProviders } from '#services/social_accounts'
import { loginAccountLimiter } from '#start/limiter'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', { socialProviders: socialProviders() })
  }

  async store(ctx: HttpContext) {
    const { request, auth, response } = ctx
    const { email, password } = await request.validateUsing(loginValidator)
    let user: User
    try {
      const [blocked, verified] = await loginAccountLimiter.penalize(`login_account:${email}`, () =>
        User.verifyCredentials(email, password)
      )
      if (blocked) {
        const known = await User.findBy('email', email)
        if (known)
          await logAuthActivity({
            userId: known.id,
            action: 'login_failed',
            changes: { ...requestContext(ctx), reason: 'locked' },
          })
        return this.refuse(
          ctx,
          'تجاوزت محاولات الدخول الفاشلة لهذا الحساب. انتظر ربع ساعة أو استعد كلمة المرور.'
        )
      }
      user = verified as User
    } catch (error) {
      if (!(error instanceof authErrors.E_INVALID_CREDENTIALS)) throw error
      // Unknown e-mails cannot be logged (activities reference users); the limiter counts them.
      const known = await User.findBy('email', email)
      if (known)
        await logAuthActivity({
          userId: known.id,
          action: 'login_failed',
          changes: requestContext(ctx),
        })
      return this.refuse(ctx, 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    }
    if (user.disabledAt) {
      await logAuthActivity({
        userId: user.id,
        action: 'login_failed',
        changes: { ...requestContext(ctx), reason: 'disabled' },
      })
      return this.refuse(ctx, 'هذا الحساب معطّل. تواصل مع مدير النظام.')
    }

    await auth.use('web').login(user)
    await recordSession(ctx, user.id)
    await logAuthActivity({ userId: user.id, action: 'login', changes: requestContext(ctx) })
    response.redirect().toRoute('home')
  }

  async destroy(ctx: HttpContext) {
    const { auth, response, session } = ctx
    const user = auth.getUserOrFail()
    const sessionId = session.sessionId
    await auth.use('web').logout()
    await endSession(sessionId)
    await logAuthActivity({ userId: user.id, action: 'logout', changes: requestContext(ctx) })
    response.redirect().toRoute('session.create')
  }

  private refuse({ request, response, session }: HttpContext, message: string) {
    if (request.accepts(['html', 'json']) === 'json')
      return response.unauthorized({ errors: [{ message }] })
    session.flashExcept(['password'])
    session.flash('inputErrorsBag', { email: [message] })
    return response.redirect().toRoute('session.create')
  }
}
