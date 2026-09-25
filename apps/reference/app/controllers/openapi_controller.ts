import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { openApiDocument, KIT_VERSION } from '@adula/kit'
import { kit, requestActor } from '#services/kit'

/** The API description for the calling token's owner, generated from the registry. */
export default class OpenApiController {
  async handle(ctx: HttpContext) {
    return openApiDocument(kit().registry, {
      title: 'Resource API',
      version: KIT_VERSION,
      serverUrl: env.get('APP_URL'),
      actor: await requestActor(ctx),
    })
  }
}
