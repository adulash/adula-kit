import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import { actorId, mutate, wantsJson } from './support.js'
import {
  setup,
  setupSnapshot,
  identityFingerprint,
  storageFingerprint,
  infrastructureFingerprint,
  probeStorage,
  probeInfrastructure,
} from '#services/initial_setup'

export default class SetupController {
  async index(ctx: HttpContext) {
    const state = await setupSnapshot(ctx.auth.getUserOrFail())
    if (wantsJson(ctx)) return state
    return ctx.inertia.render('admin/setup/index', state)
  }
  async check(ctx: HttpContext) {
    return mutate(
      ctx,
      async () => {
        const name = ctx.params.service
        if (name !== 'storage' && name !== 'infrastructure')
          throw new KitError(422, 'E_SETUP_SERVICE', 'الخدمة غير معروفة')
        await setup().check(
          actorId(ctx),
          name,
          name === 'storage' ? storageFingerprint() : infrastructureFingerprint(),
          name === 'storage' ? probeStorage : probeInfrastructure
        )
      },
      'نجح فحص الخدمة',
      '/admin/setup'
    )
  }
  async confirmIdentity(ctx: HttpContext) {
    return mutate(
      ctx,
      async () => {
        if (ctx.request.input('confirmed') !== true)
          throw new KitError(422, 'E_SETUP_CONFIRM', 'تأكيد الهوية مطلوب')
        await setup().acknowledgeIdentity(actorId(ctx), await identityFingerprint())
      },
      'تم اعتماد الهوية الحالية',
      '/admin/setup'
    )
  }
  async notification(ctx: HttpContext) {
    return mutate(
      ctx,
      () => setup().testNotification(actorId(ctx)),
      'أُنشئ الإشعار التجريبي. افتح الإشعارات وحدده كمقروء.',
      '/admin/setup'
    )
  }
}
