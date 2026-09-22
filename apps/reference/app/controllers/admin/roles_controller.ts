import type { HttpContext } from '@adonisjs/core/http'
import { RolesAdmin } from '@adula/kit'
import { kit } from '#services/kit'
import { actorId, knex, mutate, positiveId, wantsJson } from './support.js'

const service = () => new RolesAdmin(knex(), kit().registry)

export default class RolesController {
  async index(ctx: HttpContext) {
    const roles = await service().list()
    if (wantsJson(ctx)) return { data: roles }
    return ctx.inertia.render('admin/roles/index', { roles })
  }

  async store(ctx: HttpContext) {
    return mutate(
      ctx,
      () =>
        service().create(actorId(ctx), {
          name: ctx.request.input('name'),
          permissionLevel: ctx.request.input('permissionLevel'),
        }),
      'تم إنشاء الدور'
    )
  }

  async show(ctx: HttpContext) {
    const role = await service().get(positiveId(ctx.params.id))
    const matrix = service().matrix()
    if (wantsJson(ctx)) return { data: role, matrix }
    return ctx.inertia.render('admin/roles/show', { role, matrix })
  }

  async update(ctx: HttpContext) {
    const id = positiveId(ctx.params.id)
    return mutate(
      ctx,
      async () => {
        const { name, permissionLevel } = ctx.request.only(['name', 'permissionLevel'])
        if (name !== undefined) await service().rename(actorId(ctx), id, name)
        if (permissionLevel !== undefined)
          await service().setPermissionLevel(actorId(ctx), id, Number(permissionLevel))
      },
      'تم تحديث الدور'
    )
  }

  async destroy(ctx: HttpContext) {
    return mutate(
      ctx,
      () => service().delete(actorId(ctx), positiveId(ctx.params.id)),
      'تم حذف الدور',
      '/admin/roles'
    )
  }

  async setRule(ctx: HttpContext) {
    return mutate(
      ctx,
      () =>
        service().setRule(
          actorId(ctx),
          positiveId(ctx.params.id),
          ctx.request.only(['subject', 'action', 'inverted', 'conditions', 'fields'])
        ),
      'تم حفظ القاعدة'
    )
  }

  async removeRule(ctx: HttpContext) {
    return mutate(
      ctx,
      () =>
        service().removeRule(actorId(ctx), positiveId(ctx.params.id), positiveId(ctx.params.rule)),
      'تم حذف القاعدة'
    )
  }
}
