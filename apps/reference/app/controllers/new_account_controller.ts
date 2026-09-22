import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { logAuthActivity, requestContext } from '#services/auth_activity'
import { recordSession } from '#services/sessions'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const { passwordConfirmation, ...payload } = await request.validateUsing(signupValidator)
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
