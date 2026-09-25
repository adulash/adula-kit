import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import User from '#models/user'
import { logAuthActivity, requestContext } from '#services/auth_activity'
import { twoFactor } from '#services/two_factor'

/** Self-service enrollment, recovery codes and removal of two-factor authentication. */
export default class TwoFactorController {
  async show(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const service = await twoFactor()
    return ctx.inertia.render('account/two_factor', { status: await service.status(user.id) })
  }

  async begin(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const service = await twoFactor()
    return { data: await service.begin(user.id, user.email) }
  }

  async confirm(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const service = await twoFactor()
    const codes = await service.confirm(user.id, ctx.request.input('code'))
    await logAuthActivity({
      userId: user.id,
      action: 'two_factor_enabled',
      changes: requestContext(ctx),
    })
    return { data: { recoveryCodes: codes } }
  }

  /** Regenerating recovery codes needs a current authenticator code. */
  async recovery(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const service = await twoFactor()
    if ((await service.verify(user.id, ctx.request.input('code'))) !== 'totp')
      throw new KitError(422, 'E_2FA_CODE', 'رمز التحقق غير صحيح')
    const codes = await service.regenerateRecoveryCodes(user.id)
    await logAuthActivity({
      userId: user.id,
      action: 'two_factor_recovery_regenerated',
      changes: requestContext(ctx),
    })
    return { data: { recoveryCodes: codes } }
  }

  /** Disabling needs both the password and a current code (or a recovery code). */
  async disable(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    try {
      await User.verifyCredentials(user.email, String(ctx.request.input('password') ?? ''))
    } catch {
      throw new KitError(422, 'E_PASSWORD', 'كلمة المرور غير صحيحة')
    }
    const service = await twoFactor()
    if (!(await service.verify(user.id, ctx.request.input('code'))))
      throw new KitError(422, 'E_2FA_CODE', 'رمز التحقق غير صحيح')
    await service.disable(user.id)
    await logAuthActivity({
      userId: user.id,
      action: 'two_factor_disabled',
      changes: requestContext(ctx),
    })
    return { data: true }
  }
}
