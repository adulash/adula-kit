import type { HttpContext } from '@adonisjs/core/http'
import { KitError } from '@adula/kit'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import User from '#models/user'
import { positiveId, wantsJson } from '#controllers/admin/support'

const ACCESS = { read: ['read'], write: ['read', 'write'] } as const

function present(token: AccessToken) {
  return {
    id: Number(token.identifier),
    name: token.name,
    access: token.abilities.includes('write') ? ('write' as const) : ('read' as const),
    lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt).toISOString() : null,
    expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : null,
    createdAt: new Date(token.createdAt).toISOString(),
  }
}

/** Users manage their own personal API tokens; secrets are shown once. */
export default class ApiTokensController {
  async index(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const all = await User.accessTokens.all(user)
    const tokens = all.map(present)
    if (wantsJson(ctx)) return { data: tokens }
    return ctx.inertia.render('account/tokens', { tokens })
  }

  async store(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const name = String(ctx.request.input('name') ?? '').trim()
    if (!name || name.length > 60)
      throw new KitError(422, 'E_TOKEN_NAME', 'اسم الرمز مطلوب ولا يتجاوز 60 حرفاً')
    const access = ctx.request.input('access') === 'write' ? 'write' : 'read'
    const days = Number(ctx.request.input('expiresInDays') ?? 90)
    if (!Number.isInteger(days) || days < 1 || days > 365)
      throw new KitError(422, 'E_TOKEN_EXPIRY', 'مدة الصلاحية بين يوم و365 يوماً')
    const existing = await User.accessTokens.all(user)
    if (existing.length >= 20)
      throw new KitError(422, 'E_TOKEN_LIMIT', 'بلغت الحد الأقصى للرموز (20)')
    const token = await User.accessTokens.create(user, [...ACCESS[access]], {
      name,
      expiresIn: `${days} days`,
    })
    return ctx.response.created({ data: { token: present(token), secret: token.value!.release() } })
  }

  async destroy(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const removed = await User.accessTokens.delete(
      user,
      positiveId(ctx.params.id, 'الرمز غير موجود')
    )
    if (!removed) throw new KitError(404, 'E_TOKEN_NOT_FOUND', 'الرمز غير موجود')
    return { data: true }
  }
}
