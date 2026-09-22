import type { HttpContext } from '@adonisjs/core/http'
import { buildAbility, type Actor, type ResourceEditor, type ResourceList } from '@adula/kit'
import type { kit } from '#services/kit'

// Only the test runtime imports these legacy page adapters. They exercise page overrides.
declare module '@adonisjs/inertia/types' {
  interface InertiaPages {
    'orders/index': {
      result: ResourceList
      canCreate: boolean
      canEdit: boolean
      showTotal: boolean
    }
    'orders/form': { editor: ResourceEditor }
  }
}

export function index(
  ctx: HttpContext,
  page: string,
  runtime: ReturnType<typeof kit>,
  actor: Actor,
  result: ResourceList
) {
  if (page !== 'orders/index') return undefined
  const ability = buildAbility(actor.rules, runtime.registry.all())
  return ctx.inertia.render('orders/index', {
    result,
    canCreate: ability.can('create', 'orders'),
    canEdit: ability.can('update', 'orders'),
    showTotal: actor.permissionLevel >= 1 && ability.can('view', 'orders', 'total'),
  })
}

export function form(ctx: HttpContext, page: string, editor: ResourceEditor) {
  if (page !== 'orders/form') return undefined
  return ctx.inertia.render('orders/form', { editor })
}
