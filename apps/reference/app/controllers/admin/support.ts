import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { KitError } from '@adula/kit'

export const knex = () => db.connection().getWriteClient()
export const actorId = (ctx: HttpContext) => ctx.auth.getUserOrFail().id
export const wantsJson = (ctx: HttpContext) => ctx.request.accepts(['html', 'json']) === 'json'
export const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

export function positiveId(value: unknown, message = 'السجل غير موجود') {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new KitError(404, 'E_NOT_FOUND', message)
  return id
}
export function optionalId(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  return positiveId(value, 'المعرّف غير صالح')
}

/** API clients get JSON; Inertia forms get a flash and a redirect so the page re-renders. */
export async function mutate(
  ctx: HttpContext,
  run: () => Promise<unknown>,
  success: string,
  redirectTo?: string
) {
  try {
    const data = await run()
    if (wantsJson(ctx)) return { data: data ?? true }
    ctx.session.flash('success', success)
    return redirectTo ? ctx.response.redirect(redirectTo) : ctx.response.redirect().back()
  } catch (error) {
    if (wantsJson(ctx)) throw error
    const code = (error as { code?: string })?.code
    const message =
      error instanceof KitError
        ? error.message
        : code === '23505'
          ? 'هذه القيمة مستخدمة في سجل آخر'
          : code === '23503'
            ? 'تحقق من السجلات المرتبطة'
            : undefined
    if (!message) throw error
    ctx.session.flash('error', message)
    return ctx.response.redirect().back()
  }
}
