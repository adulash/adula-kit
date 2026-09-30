import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import { kit, requestActor } from '#services/kit'
import { positiveId } from '#controllers/admin/support'
import { childDescriptions, pageFor } from '#controllers/resources_controller'

/**
 * A record's view or edit form as JSON, so the generic list opens it in a dialog over
 * itself instead of navigating away (#31). The record is read once. Resources with a
 * page override answer 409 and the list navigates to their own page instead.
 */
export default class RecordViewsController {
  async show(ctx: HttpContext) {
    const runtime = kit()
    const actor = await requestActor(ctx)
    const id = positiveId(ctx.params.id)
    try {
      let resource
      try {
        resource = runtime.registry.get(ctx.params.resource)
      } catch {
        throw new KitError(404, 'E_NOT_FOUND', 'الكيان غير موجود')
      }
      const edit = ctx.request.input('mode') === 'edit'
      if (pageFor(resource.name, edit ? 'form' : 'show') !== 'resources/page')
        throw new KitError(409, 'E_PAGE_OVERRIDE', 'لهذا الكيان صفحة مخصصة')
      if (edit) {
        const editor = await runtime.resources.editor(resource.name, actor, id)
        const shown = await runtime.resources.show(resource.name, id, actor)
        return { view: { mode: 'form' as const, editor, permissions: shown.permissions } }
      }
      const { children, activity, ...result } = await runtime.resources.record(
        resource.name,
        id,
        actor
      )
      const description = runtime.resources.describe(resource.name, actor)
      return {
        view: {
          mode: 'show' as const,
          resource: description,
          result,
          lookups: await runtime.resources.lookups(resource.name, actor),
          childResources: childDescriptions(description, actor),
        },
        childrenData: children,
        activity,
      }
    } catch (error) {
      if (error instanceof KitError)
        return ctx.response
          .status(error.status)
          .send({ error: { code: error.code, message: error.message } })
      throw error
    }
  }
}
