import type { HttpContext } from '@adonisjs/core/http'
import { KitError, type Actor } from '@adula/kit'
import { kit, requestActor } from '#services/kit'
import { positiveId, wantsJson } from '#controllers/admin/support'

type Tab = 'all' | 'approvals' | 'assigned' | 'closed'
const tabs: Record<Tab, { status: 'open' | 'done'; kind?: 'approval' | 'task' }> = {
  all: { status: 'open' },
  approvals: { status: 'open', kind: 'approval' },
  assigned: { status: 'open', kind: 'task' },
  closed: { status: 'done' },
}

/**
 * "My tasks": manual assignments and workflow approvals in one list with tabs (#35),
 * and record assignments. The kit re-authorizes each record.
 */
export default class AssignmentsController {
  async mine(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => {
      const requested = ctx.request.input('tab')
      // Earlier links used ?status=open|done.
      const tab: Tab =
        typeof requested === 'string' && Object.hasOwn(tabs, requested)
          ? (requested as Tab)
          : ctx.request.input('status') === 'done'
            ? 'closed'
            : 'all'
      const page = await kit().assignments.mine(actor, {
        ...tabs[tab],
        cursor: ctx.request.input('cursor'),
      })
      if (wantsJson(ctx)) return page
      // Decision steps name their outcomes on the run; the inbox applies the same checks.
      const inbox = page.data.some((item) => item.canDecide)
        ? await kit().workflows.inbox(actor)
        : []
      const decisions = Object.fromEntries(inbox.map((run) => [run.id, run]))
      return ctx.inertia.render('work/my_tasks', { assignments: page, tab, decisions })
    })
  }

  async complete(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => {
      await kit().assignments.complete(ctx.params.assignment, actor, 'done', {
        note: ctx.request.input('note'),
      })
      return { data: true }
    })
  }

  async cancel(ctx: HttpContext) {
    return this.#run(ctx, async (actor) => {
      await kit().assignments.complete(ctx.params.assignment, actor, 'cancelled', {
        note: ctx.request.input('note'),
      })
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
