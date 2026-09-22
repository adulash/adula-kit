import type { HttpContext } from '@adonisjs/core/http'
import queue from '@nemoventures/adonis-jobs/services/main'
import { KitError, logActivity, runtimeHealth, type QueueSnapshot } from '@adula/kit'
import { actorId, knex, mutate, wantsJson } from './support.js'

/** BullMQ stays in the application; the kit only defines the snapshot shape. */
async function snapshot(): Promise<QueueSnapshot> {
  const events = queue.useQueue('events')
  const counts = await events.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed')
  const failed = await events.getFailed(0, 49)
  return {
    name: 'events',
    counts: {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    },
    failed: failed.map((job) => ({
      id: String(job.id),
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? '',
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    })),
  }
}

export default class JobsController {
  async index(ctx: HttpContext) {
    const props = { health: await runtimeHealth(knex()), queues: [await snapshot()] }
    if (wantsJson(ctx)) return props
    return ctx.inertia.render('admin/jobs/index', props)
  }

  async retry(ctx: HttpContext) {
    const id = String(ctx.params.id)
    if (!/^[\w-]{1,128}$/.test(id)) throw new KitError(404, 'E_JOB_NOT_FOUND', 'الوظيفة غير موجودة')
    return mutate(
      ctx,
      async () => {
        const job = await queue.useQueue('events').getJob(id)
        if (!job) throw new KitError(404, 'E_JOB_NOT_FOUND', 'الوظيفة غير موجودة')
        if (!(await job.isFailed()))
          throw new KitError(422, 'E_JOB_NOT_FAILED', 'يمكن إعادة المحاولة للوظائف الفاشلة فقط')
        await job.retry()
        await logActivity(knex(), {
          resource: 'core.jobs',
          recordId: 0,
          actorId: actorId(ctx),
          action: 'retry',
          changes: { jobId: id, name: job.name },
        })
        return { id, state: await job.getState() }
      },
      'أعيدت الوظيفة إلى الطابور'
    )
  }
}
