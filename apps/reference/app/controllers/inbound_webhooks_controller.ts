import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import { kit } from '#services/kit'

/**
 * Public receiver for signed inbound webhooks (#30). The kit verifies the HMAC over the
 * raw body before anything is stored; errors carry no detail about the source.
 */
export default class InboundWebhooksController {
  async receive(ctx: HttpContext) {
    try {
      const receipt = await kit().inbound.receive(String(ctx.params.source), {
        headers: ctx.request.headers(),
        body: ctx.request.raw() ?? '',
      })
      return ctx.response.accepted({ data: receipt })
    } catch (error) {
      if (error instanceof KitError)
        return ctx.response
          .status(error.status)
          .send({ error: { code: error.code, message: error.message } })
      throw error
    }
  }
}
