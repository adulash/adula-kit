import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { buildAbility } from '@adula/kit'
import { kit } from '#services/kit'
import {
  listActiveSessions,
  resolveSessionHandle,
  revokeSession,
  sessionHandle,
} from '#services/sessions'

/** Every live session across users; only actors who can manage everything. */
export default class AdminSessionsController {
  async index(ctx: HttpContext) {
    await this.authorize(ctx)
    return ctx.inertia.render('admin/sessions/index', {
      sessions: await listActiveSessions(),
      currentSessionId: sessionHandle(ctx.session.sessionId),
    })
  }

  async destroy(ctx: HttpContext) {
    const actor = await this.authorize(ctx)
    const id = await resolveSessionHandle(String(ctx.params.id))
    const revoked = id ? await revokeSession(id, actor.id) : null
    if (revoked) ctx.session.flash('success', 'أُنهيت الجلسة وسيُطلب من صاحبها الدخول مجدداً.')
    else ctx.session.flash('error', 'الجلسة غير موجودة أو أُنهيت من قبل.')
    return ctx.response.redirect().toRoute('admin_sessions.index')
  }

  private async authorize({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const actor = await kit().actors.load(user.id)
    const ability = buildAbility(actor.rules, kit().registry.all())
    if (!ability.can('manage', 'all'))
      throw new Exception('غير مصرح لك بالوصول إلى هذه الصفحة', {
        status: 403,
        code: 'E_FORBIDDEN',
      })
    return user
  }
}
