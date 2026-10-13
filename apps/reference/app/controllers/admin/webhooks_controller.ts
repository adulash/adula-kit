import type { HttpContext } from '@adonisjs/core/http'
import { AdulaError } from 'adula'
import { adula } from '#services/adula'
import { actorId, positiveId, wantsJson } from './support.js'

/** Administrators manage outgoing webhooks; secrets are shown once at creation. */
export default class WebhooksController {
  async index(ctx: HttpContext) {
    const webhooks = await adula().webhooks.list()
    const events = adula().webhooks.events()
    const inbound = await adula().inbound.list()
    if (wantsJson(ctx)) return { data: webhooks, events, inbound }
    return ctx.inertia.render('admin/webhooks/index', { webhooks, events, inbound })
  }

  /** Inbound sources: the secret is returned once, at creation or rotation. */
  async storeInbound(ctx: HttpContext) {
    const created = await adula().inbound.create(actorId(ctx), this.#inbound(ctx))
    return ctx.response.created({ data: created })
  }

  async updateInbound(ctx: HttpContext) {
    await adula().inbound.update(positiveId(ctx.params.id), {
      ...this.#inbound(ctx),
      active: ctx.request.input('active'),
    })
    return { data: true }
  }

  async rotateInbound(ctx: HttpContext) {
    return { data: { secret: await adula().inbound.rotate(positiveId(ctx.params.id)) } }
  }

  async destroyInbound(ctx: HttpContext) {
    await adula().inbound.remove(positiveId(ctx.params.id))
    return { data: true }
  }

  async inboundDeliveries(ctx: HttpContext) {
    return { data: await adula().inbound.deliveries(positiveId(ctx.params.id)) }
  }

  async redispatchInbound(ctx: HttpContext) {
    const id = String(ctx.params.delivery)
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new AdulaError(404, 'E_INBOUND_DELIVERY_NOT_FOUND', 'الاستلام غير موجود')
    await adula().inbound.redispatch(id)
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
      'dedupeBody',
    ])
  }

  async store(ctx: HttpContext) {
    const created = await adula().webhooks.create(actorId(ctx), {
      name: ctx.request.input('name'),
      url: ctx.request.input('url'),
      events: ctx.request.input('events'),
    })
    return ctx.response.created({ data: created })
  }

  async update(ctx: HttpContext) {
    await adula().webhooks.update(positiveId(ctx.params.id), {
      name: ctx.request.input('name'),
      url: ctx.request.input('url'),
      events: ctx.request.input('events'),
      active: ctx.request.input('active'),
    })
    return { data: true }
  }

  async destroy(ctx: HttpContext) {
    await adula().webhooks.remove(positiveId(ctx.params.id))
    return { data: true }
  }

  async deliveries(ctx: HttpContext) {
    return { data: await adula().webhooks.deliveries(positiveId(ctx.params.id)) }
  }

  async retry(ctx: HttpContext) {
    const id = String(ctx.params.delivery)
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new AdulaError(404, 'E_DELIVERY_NOT_FOUND', 'لا توجد محاولة فاشلة بهذا المعرّف')
    await adula().webhooks.retry(id)
    return { data: true }
  }
}
