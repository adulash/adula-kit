import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { isSocialProvider, linkOrCreateSocialUser } from '#services/social_accounts'
import { logAuthActivity, requestContext } from '#services/auth_activity'
import { recordSession } from '#services/sessions'
import { Settings } from '@adula/kit'
import db from '@adonisjs/lucid/services/db'
import { oauthFingerprint } from '#services/initial_setup'

/** Unknown or unconfigured providers behave like a missing route. */
const notFound = () =>
  new Exception('الصفحة غير موجودة', { status: 404, code: 'E_ROUTE_NOT_FOUND' })

export default class OauthController {
  async redirect({ params, ally }: HttpContext) {
    const provider: unknown = params.provider
    if (!isSocialProvider(provider)) throw notFound()
    return ally.use(provider).redirect()
  }

  async callback(ctx: HttpContext) {
    const { params, ally, auth, response, session } = ctx
    const provider: unknown = params.provider
    if (!isSocialProvider(provider)) throw notFound()
    const driver = ally.use(provider)
    const fail = (message: string) => {
      session.flash('error', message)
      return response.redirect().toRoute('session.create')
    }
    if (driver.accessDenied()) return fail('ألغيت تسجيل الدخول قبل منح الإذن.')
    if (driver.stateMisMatch()) return fail('انتهت صلاحية طلب تسجيل الدخول. حاول مجدداً.')
    if (driver.hasError()) return fail(`تعذّر تسجيل الدخول عبر المزوّد: ${driver.getError()}`)

    const profile = await driver.user()
    if (!profile.email || profile.emailVerificationState !== 'verified')
      return fail('يتطلب الدخول بريداً إلكترونياً موثقاً لدى المزوّد.')
    const { user, created } = await linkOrCreateSocialUser({
      provider,
      providerId: String(profile.id),
      email: profile.email,
      name: profile.name || profile.nickName || null,
    })
    if (user.disabledAt) return fail('هذا الحساب معطّل. تواصل مع مدير النظام.')

    await auth.use('web').login(user)
    await recordSession(ctx, user.id)
    await new Settings(db.connection().getWriteClient()).set(`setup.oauth.${provider}`, {
      fingerprint: oauthFingerprint(provider),
      at: new Date().toISOString(),
    })
    await logAuthActivity({
      userId: user.id,
      action: 'oauth_login',
      changes: { ...requestContext(ctx), provider, created },
    })
    return response.redirect().toRoute('home')
  }
}
