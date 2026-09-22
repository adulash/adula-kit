import type { HttpContext } from '@adonisjs/core/http'
import { NotificationsAdmin } from '@adula/kit'
import { actorId, knex, mutate, positiveId, text, wantsJson } from './support.js'

/** Every signed-in user reads their own inbox; there is no administrative view of it. */
export default class NotificationsController {
  async index(ctx: HttpContext) {
    const notifications = await new NotificationsAdmin(knex()).list(actorId(ctx), {
      cursor: text(ctx.request.input('cursor')),
      limit: ctx.request.input('limit'),
    })
    if (wantsJson(ctx)) return notifications
    return ctx.inertia.render('admin/notifications/index', { notifications })
  }

  async read(ctx: HttpContext) {
    return mutate(
      ctx,
      () => new NotificationsAdmin(knex()).markRead(actorId(ctx), positiveId(ctx.params.id)),
      'تم تعيين الإشعار كمقروء'
    )
  }

  async readAll(ctx: HttpContext) {
    return mutate(
      ctx,
      () => new NotificationsAdmin(knex()).markAllRead(actorId(ctx)),
      'تم تعيين كل الإشعارات كمقروءة'
    )
  }
}
