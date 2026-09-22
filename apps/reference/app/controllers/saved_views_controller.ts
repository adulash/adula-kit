import type { HttpContext } from '@adonisjs/core/http'
import { KitError, type Actor as KitActor } from '@adula/kit'
import { kit } from '#services/kit'

/** Saved views are per-actor list presets; the kit validates every query key. */
export default class SavedViewsController {
  async store(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource) => ({
      data: await kit().savedViews.save(resource, actor, {
        name: ctx.request.input('name'),
        query: ctx.request.input('query'),
        shared: ctx.request.input('shared') === true,
      }),
    }))
  }

  async destroy(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource) => {
      const id = Number(ctx.params.id)
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new KitError(404, 'E_VIEW_NOT_FOUND', 'العرض المحفوظ غير موجود')
      await kit().savedViews.remove(resource, actor, id)
      return { data: { id } }
    })
  }

  async #run(ctx: HttpContext, action: (actor: KitActor, resource: string) => Promise<unknown>) {
    try {
      const actor = await kit().actors.load(ctx.auth.getUserOrFail().id)
      return await action(actor, ctx.params.resource)
    } catch (error) {
      if (error instanceof KitError)
        return ctx.response
          .status(error.status)
          .send({ error: { code: error.code, message: error.message } })
      throw error
    }
  }
}
