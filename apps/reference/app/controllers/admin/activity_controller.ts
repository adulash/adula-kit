import type { HttpContext } from '@adonisjs/core/http'
import { ActivityAdmin } from '@adula/kit'
import { knex, optionalId, text, wantsJson } from './support.js'

export default class ActivityController {
  async index(ctx: HttpContext) {
    const filters = {
      resource: text(ctx.request.input('resource')),
      action: text(ctx.request.input('action')),
      actorId: optionalId(ctx.request.input('actorId')) ?? undefined,
      from: text(ctx.request.input('from')),
      to: text(ctx.request.input('to')),
    }
    const service = new ActivityAdmin(knex())
    const activity = await service.list({
      ...filters,
      cursor: text(ctx.request.input('cursor')),
      limit: ctx.request.input('limit'),
    })
    if (wantsJson(ctx)) return activity
    return ctx.inertia.render('admin/activity/index', {
      activity,
      facets: await service.facets(),
      filters: {
        resource: filters.resource ?? '',
        action: filters.action ?? '',
        actorId: filters.actorId ? String(filters.actorId) : '',
        from: filters.from ?? '',
        to: filters.to ?? '',
      },
    })
  }
}
