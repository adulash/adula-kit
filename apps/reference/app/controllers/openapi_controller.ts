import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { openApiDocument, ADULA_VERSION } from 'adula'
import { adula, requestActor } from '#services/adula'

/** The API description for the calling token's owner, generated from the registry. */
export default class OpenApiController {
  async handle(ctx: HttpContext) {
    return openApiDocument(adula().registry, {
      title: 'Resource API',
      version: ADULA_VERSION,
      serverUrl: env.get('APP_URL'),
      actor: await requestActor(ctx),
    })
  }
}
