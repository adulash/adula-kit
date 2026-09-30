import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import { kit, requestActor } from '#services/kit'
import { positiveId, wantsJson } from '#controllers/admin/support'

const runId = (value: unknown) => {
  const id = String(value)
  if (!/^[0-9a-f-]{36}$/.test(id))
    throw new KitError(404, 'E_WORKFLOW_NOT_FOUND', 'التدفق غير موجود')
  return id
}

/** Workflow runs of a record, the approvals inbox and approval decisions. */
export default class WorkflowsController {
  async forRecord(ctx: HttpContext) {
    const actor = await requestActor(ctx)
    return {
      data: await kit().workflows.runsFor(ctx.params.resource, positiveId(ctx.params.id), actor),
    }
  }

  /** JSON inbox for integrations; people decide from My tasks (#35), where pages redirect. */
  async inbox(ctx: HttpContext) {
    if (!wantsJson(ctx)) return ctx.response.redirect('/my-tasks?tab=approvals')
    return { data: await kit().workflows.inbox(await requestActor(ctx)) }
  }

  async decide(ctx: HttpContext) {
    // The engine checks the decision against the current step: approve/reject for an
    // approval step, one of the declared outcomes for a decision step.
    const decision = ctx.request.input('decision')
    if (typeof decision !== 'string' || !decision)
      throw new KitError(422, 'E_WORKFLOW_DECISION', 'القرار غير صالح')
    return {
      data: await kit().workflows.decide(
        runId(ctx.params.run),
        await requestActor(ctx),
        decision,
        ctx.request.input('comment')
      ),
    }
  }

  async failed(ctx: HttpContext) {
    const runs = await kit().workflows.failed()
    if (wantsJson(ctx)) return { data: runs }
    return ctx.inertia.render('admin/workflows/index', { runs })
  }

  async retry(ctx: HttpContext) {
    await kit().workflows.retry(runId(ctx.params.run), ctx.auth.getUserOrFail().id)
    return { data: true }
  }
}
