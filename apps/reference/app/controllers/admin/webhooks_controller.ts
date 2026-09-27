import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import { kit } from '#services/kit'
import { actorId, positiveId, wantsJson } from './support.js'

/** Administrators manage outgoing webhooks; secrets are shown once at creation. */
export default class WebhooksController {
  async index(ctx: HttpContext) {
    const webhooks = await kit().webhooks.list()
    const events = kit().webhooks.events()
    const inbound = await kit().inbound.list()
    if (wantsJson(ctx)) return { data: webhooks, events, inbound }
    return ctx.inertia.render('admin/webhooks/index', { webhooks, events, inbound })
  }

  /** Inbound sources: the secret is returned once, at creation or rotation. */
  async storeInbound(ctx: HttpContext) {
    const created = await kit().inbound.create(actorId(ctx), this.#inbound(ctx))
    return ctx.response.created({ data: created })
  }

  async updateInbound(ctx: HttpContext) {
    await kit().inbound.update(positiveId(ctx.params.id), {
      ...this.#inbound(ctx),
      active: ctx.request.input('active'),
    })
    return { data: true }
  }

  async rotateInbound(ctx: HttpContext) {
    return { data: { secret: await kit().inbound.rotate(positiveId(ctx.params.id)) } }
  }

  async destroyInbound(ctx: HttpContext) {
    await kit().inbound.remove(positiveId(ctx.params.id))
    return { data: true }
  }

  async inboundDeliveries(ctx: HttpContext) {
    return { data: await kit().inbound.deliveries(positiveId(ctx.params.id)) }
  }

  async redispatchInbound(ctx: HttpContext) {
    const id = String(ctx.params.delivery)
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new KitError(404, 'E_INBOUND_DELIVERY_NOT_FOUND', 'الاستلام غير موجود')
    await kit().inbound.redispatch(id)
    return { data: true }
  }

  #inbound(ctx: HttpContext) {
    return ctx.request.only([
      'key',
      'name',
      'algorithm',
      'signatureHeader',
      'signaturePrefix',
      'eventHeader',
      'deliveryHeader',
    ])
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
