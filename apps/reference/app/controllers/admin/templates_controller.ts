import type { HttpContext } from '@adonisjs/core/http'
import { MessageTemplates } from '@adula/kit'
import { actorId, knex, mutate, wantsJson } from './support.js'

/** Administrators edit notification wording; package defaults stay untouched. */
export default class TemplatesController {
  async index(ctx: HttpContext) {
    const templates = await new MessageTemplates(knex()).list()
    if (wantsJson(ctx)) return { data: templates }
    return ctx.inertia.render('admin/templates/index', { templates })
  }

  async update(ctx: HttpContext) {
    return mutate(
      ctx,
      () =>
        new MessageTemplates(knex()).update(
          String(ctx.params.key),
          {
            subject: ctx.request.input('subject'),
            body: ctx.request.input('body'),
            mail: ctx.request.input('mail'),
          },
          actorId(ctx)
        ),
      'تم حفظ القالب'
    )
  }

  async reset(ctx: HttpContext) {
    return mutate(
      ctx,
      () => new MessageTemplates(knex()).reset(String(ctx.params.key)),
      'أُعيد القالب إلى نصه الافتراضي'
    )
  }
}
