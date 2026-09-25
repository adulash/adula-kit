import type { HttpContext } from '@adonisjs/core/http'
import { KitError, type Actor } from '@adula/kit'
import { kit, requestActor } from '#services/kit'
import { positiveId } from '#controllers/admin/support'

/** Comments, mentions, followers and tags around a record; the kit re-authorizes the record. */
export default class RecordCollaborationController {
  async show(ctx: HttpContext) {
    return this.#run(ctx, (actor, resource, id) => kit().collaboration.state(resource, id, actor))
  }

  async mentions(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource, id) => ({
      data: await kit().collaboration.mentionCandidates(
        resource,
        id,
        actor,
        String(ctx.request.input('search') ?? '')
      ),
    }))
  }

  async comment(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource, id) =>
      ctx.response.created({
        data: await kit().collaboration.comment(resource, id, actor, {
          body: ctx.request.input('body'),
          mentions: ctx.request.input('mentions'),
        }),
      })
    )
  }

  async editComment(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource, id) => {
      await kit().collaboration.editComment(
        resource,
        id,
        ctx.params.comment,
        actor,
        ctx.request.input('body')
      )
      return { data: true }
    })
  }

  async deleteComment(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource, id) => {
      await kit().collaboration.deleteComment(resource, id, ctx.params.comment, actor)
      return { data: true }
    })
  }

  async follow(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource, id) => {
      await kit().collaboration.follow(resource, id, actor, ctx.request.input('following') === true)
      return { data: true }
    })
  }

  async tags(ctx: HttpContext) {
    return this.#run(ctx, async (actor, resource, id) => ({
      data: await kit().collaboration.setTags(resource, id, actor, ctx.request.input('tags')),
    }))
  }

  async tagOptions(ctx: HttpContext) {
    try {
      const actor = await requestActor(ctx)
      kit().registry.get(ctx.params.resource)
      return { data: await kit().collaboration.tagOptions(ctx.params.resource, actor) }
    } catch (error) {
      return this.#error(ctx, error)
    }
  }

  async #run(
    ctx: HttpContext,
    action: (actor: Actor, resource: string, id: number) => Promise<unknown>
  ) {
    try {
      const actor = await requestActor(ctx)
      return await action(actor, ctx.params.resource, positiveId(ctx.params.id))
    } catch (error) {
      return this.#error(ctx, error)
    }
  }

  #error(ctx: HttpContext, error: unknown) {
    if (error instanceof KitError)
      return ctx.response
        .status(error.status)
        .send({ error: { code: error.code, message: error.message } })
    if (error instanceof Error && error.message.startsWith('Unknown resource'))
      return ctx.response.notFound({ error: { code: 'E_NOT_FOUND', message: 'الكيان غير موجود' } })
    throw error
  }
}
