import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import { NotificationsAdmin, UserInvitations, buildAbility, isBackupStale } from '@adula/kit'
import { IMPERSONATOR_KEY, kit } from '#services/kit'
import { activeImpersonation } from '#services/impersonation'

export { IMPERSONATOR_KEY }

export async function isAdministrator(userId: number) {
  const runtime = kit()
  const actor = await runtime.actors.load(userId)
  return buildAbility(actor.rules, runtime.registry.all()).can('manage', 'all')
}

/** Shell props for every Inertia page: admin navigation, backup bar, bell and impersonation. */
export async function sharedAdminProps(ctx: HttpContext) {
  const { auth, session } = ctx as Partial<HttpContext>
  const userId = auth?.user?.id
  const knex = db.connection().getWriteClient()
  const isAdmin = userId ? await isAdministrator(userId) : false
  return {
    isAdmin: ctx.inertia.always(isAdmin),
    canInviteUsers: ctx.inertia.always(
      userId ? await new UserInvitations(knex).canInvite(userId) : false
    ),
    backupWarning: ctx.inertia.always(isAdmin && (await isBackupStale(knex))),
    unreadNotifications: ctx.inertia.always(
      userId ? await new NotificationsAdmin(knex).unreadCount(userId) : 0
    ),
    impersonating: ctx.inertia.always(Boolean(activeImpersonation({ session, auth }))),
  }
}

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    if (!(await isAdministrator(user.id))) {
      if (ctx.request.accepts(['html', 'json']) === 'json')
        return ctx.response.forbidden({
          error: { code: 'E_FORBIDDEN', message: 'هذه المنطقة للمديرين فقط' },
        })
      ctx.response.status(403)
      return ctx.response.send(await ctx.inertia.render('admin/forbidden', {}))
    }
    return next()
  }
}
