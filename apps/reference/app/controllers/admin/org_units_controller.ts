import type { HttpContext } from '@adonisjs/core/http'
import { OrgUnitsAdmin } from '@adula/kit'
import { kit } from '#services/kit'
import { actorId, knex, mutate, optionalId, positiveId, wantsJson } from './support.js'

const service = () => new OrgUnitsAdmin(knex(), kit().registry)

export default class OrgUnitsController {
  async index(ctx: HttpContext) {
    const units = await service().tree()
    if (wantsJson(ctx)) return { data: units }
    return ctx.inertia.render('admin/org_units/index', { units })
  }

  async store(ctx: HttpContext) {
    return mutate(
      ctx,
      () =>
        service().create(actorId(ctx), {
          parentId: optionalId(ctx.request.input('parentId')),
          name: ctx.request.input('name'),
          type: ctx.request.input('type'),
        }),
      'تمت إضافة الوحدة'
    )
  }

  async update(ctx: HttpContext) {
    return mutate(
      ctx,
      () => service().rename(actorId(ctx), positiveId(ctx.params.id), ctx.request.input('name')),
      'تمت إعادة التسمية'
    )
  }

  async move(ctx: HttpContext) {
    return mutate(
      ctx,
      () =>
        service().move(
          actorId(ctx),
          positiveId(ctx.params.id),
          optionalId(ctx.request.input('parentId'))
        ),
      'تم نقل الوحدة'
    )
  }

  async destroy(ctx: HttpContext) {
    return mutate(
      ctx,
      () => service().delete(actorId(ctx), positiveId(ctx.params.id)),
      'تم حذف الوحدة'
    )
  }
}
