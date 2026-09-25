import type { HttpContext } from '@adonisjs/core/http'
import { KitError, type Actor } from '@adula/kit'
import { kit, requestActor } from '#services/kit'
import { positiveId, wantsJson } from '#controllers/admin/support'

/** "My tasks" and record assignments; the kit re-authorizes each record. */
export default class AssignmentsController {
  async mine(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => {
      const page = await kit().assignments.mine(actor, {
        status: ctx.request.input('status'),
        cursor: ctx.request.input('cursor'),
      })
      if (wantsJson(ctx)) return page
      return ctx.inertia.render('work/my_tasks', {
        assignments: page,
        status: ['done', 'all'].includes(ctx.request.input('status'))
          ? (ctx.request.input('status') as 'done' | 'all')
          : ('open' as const),
      })
    })
  }

  async complete(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => {
      await kit().assignments.complete(ctx.params.assignment, actor, 'done')
      return { data: true }
    })
  }

  async cancel(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => {
      await kit().assignments.complete(ctx.params.assignment, actor, 'cancelled')
      return { data: true }
    })
  }

  async forRecord(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => ({
      data: await kit().assignments.forRecord(
        ctx.params.resource,
        positiveId(ctx.params.id),
        actor
      ),
    }))
  }

  async store(ctx: HttpContext) {
    return this.#run(ctx, async (actor) =>
      ctx.response.created({
        data: await kit().assignments.assign(
          ctx.params.resource,
          positiveId(ctx.params.id),
          actor,
          {
            assigneeId: ctx.request.input('assigneeId'),
            title: ctx.request.input('title'),
            note: ctx.request.input('note'),
            dueOn: ctx.request.input('dueOn'),
          }
        ),
      })
    )
  }

  async #run(ctx: HttpContext, action: (actor: Actor) => Promise<unknown>) {
    try {
      return await action(await requestActor(ctx))
    } catch (error) {
      if (error instanceof KitError)
        return ctx.response
          .status(error.status)
          .send({ error: { code: error.code, message: error.message } })
      if (error instanceof Error && error.message.startsWith('Unknown resource'))
        return ctx.response.notFound({
          error: { code: 'E_NOT_FOUND', message: 'الكيان غير موجود' },
        })
      throw error
    }
  }
}
