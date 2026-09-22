import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { listUserSessions, revokeSession, revokeUserSessions } from '#services/sessions'

export default class AccountSessionsController {
  async index({ inertia, auth, session }: HttpContext) {
    const user = auth.getUserOrFail()
    return inertia.render('account/sessions', {
      sessions: await listUserSessions(user.id),
      currentSessionId: session.sessionId,
    })
  }

  /** Ending the current session signs the user out at once. */
  async destroy({ auth, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = String(params.id)
    const sessions = await listUserSessions(user.id)
    if (!sessions.some((entry) => entry.id === id))
      throw new Exception('الجلسة غير موجودة', {
        status: 404,
        code: 'E_ROUTE_NOT_FOUND',
      })
    await revokeSession(id, user.id)
    if (id === session.sessionId) {
      await auth.use('web').logout()
      session.flash('success', 'أُنهيت جلستك الحالية. سجّل الدخول مجدداً عند الحاجة.')
      return response.redirect().toRoute('session.create')
    }
    session.flash('success', 'أُنهيت الجلسة.')
    return response.redirect().toRoute('account_sessions.index')
  }

  async purge({ auth, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const count = await revokeUserSessions(user.id, user.id, { except: session.sessionId })
    session.flash('success', count ? `أُنهيت ${count} من الجلسات الأخرى.` : 'لا توجد جلسات أخرى.')
    return response.redirect().toRoute('account_sessions.index')
  }
}
