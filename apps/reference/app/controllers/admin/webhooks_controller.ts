import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import { kit } from '#services/kit'
import { actorId, positiveId, wantsJson } from './support.js'

/** Administrators manage outgoing webhooks; secrets are shown once at creation. */
export default class WebhooksController {
  async index(ctx: HttpContext) {
    const webhooks = await kit().webhooks.list()
    const events = kit().webhooks.events()
    if (wantsJson(ctx)) return { data: webhooks, events }
    return ctx.inertia.render('admin/webhooks/index', { webhooks, events })
  }

  async store(ctx: HttpContext) {
    const created = await kit().webhooks.create(actorId(ctx), {
      name: ctx.request.input('name'),
      url: ctx.request.input('url'),
      events: ctx.request.input('events'),
    })
    return ctx.response.created({ data: created })
  }

  async update(ctx: HttpContext) {
    await kit().webhooks.update(positiveId(ctx.params.id), {
      name: ctx.request.input('name'),
      url: ctx.request.input('url'),
      events: ctx.request.input('events'),
      active: ctx.request.input('active'),
    })
    return { data: true }
  }

  async destroy(ctx: HttpContext) {
    await kit().webhooks.remove(positiveId(ctx.params.id))
    return { data: true }
  }

  async deliveries(ctx: HttpContext) {
    return { data: await kit().webhooks.deliveries(positiveId(ctx.params.id)) }
  }

  async retry(ctx: HttpContext) {
    const id = String(ctx.params.delivery)
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new KitError(404, 'E_DELIVERY_NOT_FOUND', 'لا توجد محاولة فاشلة بهذا المعرّف')
    await kit().webhooks.retry(id)
    return { data: true }
  }
}
