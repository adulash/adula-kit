import type { HttpContext } from '@adonisjs/core/http'
import { NotificationsAdmin } from '@adula/kit'
import { registry } from '#start/modules'
import { actorId, knex, mutate, positiveId, text, wantsJson } from './support.js'

const inbox = () => new NotificationsAdmin(knex(), registry)

/** Every signed-in user reads their own inbox; there is no administrative view of it. */
export default class NotificationsController {
  async index(ctx: HttpContext) {
    const notifications = await inbox().list(actorId(ctx), {
      cursor: text(ctx.request.input('cursor')),
      limit: ctx.request.input('limit'),
    })
    if (wantsJson(ctx)) return notifications
    return ctx.inertia.render('admin/notifications/index', { notifications })
  }

  /** Marks the notification read and opens its record; the record page authorizes the reader. */
  async open(ctx: HttpContext) {
    const href = await inbox().open(actorId(ctx), positiveId(ctx.params.id))
    return ctx.response.redirect(href ?? '/notifications')
  }

  async read(ctx: HttpContext) {
    return mutate(
      ctx,
      () => inbox().markRead(actorId(ctx), positiveId(ctx.params.id)),
      'تم تعيين الإشعار كمقروء'
    )
  }

  async readAll(ctx: HttpContext) {
    return mutate(ctx, () => inbox().markAllRead(actorId(ctx)), 'تم تعيين كل الإشعارات كمقروءة')
  }
}
