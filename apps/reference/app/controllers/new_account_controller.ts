import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { logAuthActivity, requestContext } from '#services/auth_activity'
import { recordSession } from '#services/sessions'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const { passwordConfirmation, ...payload } = await request.validateUsing(signupValidator)
    // A pending invitation reserves its address: only its link can create that account.
    const invited = await db
      .from('user_invitations')
      .where('email', payload.email)
      .whereNull('accepted_at')
      .where('expires_at', '>', new Date())
      .select('id')
      .first()
    if (invited) {
      const message = 'لهذا البريد دعوة سارية. أنشئ حسابك من رابط الدعوة المرسل إليه.'
      if (request.accepts(['html', 'json']) === 'json')
        return response.unprocessableEntity({ errors: [{ field: 'email', message }] })
      session.flashExcept(['password', 'passwordConfirmation'])
      session.flash('inputErrorsBag', { email: [message] })
      return response.redirect().toRoute('new_account.create')
    }
    // Self-signup does not prove e-mail ownership: emailVerifiedAt stays null.
    const user = await User.create({ ...payload })

    await auth.use('web').login(user)
    await recordSession(ctx, user.id)
    await logAuthActivity({
      userId: user.id,
      action: 'login',
      changes: { ...requestContext(ctx), via: 'signup' },
    })
    response.redirect().toRoute('home')
  }
}
