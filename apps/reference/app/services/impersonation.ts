import type { HttpContext } from '@adonisjs/core/http'

/** Session key of the impersonation marker. */
export const IMPERSONATOR_KEY = 'impersonator_id'

/** An administrator acting as another user in this session. */
export type Impersonation = { adminId: number; targetId: number }

type SessionLike = Pick<HttpContext, 'session'>['session'] | undefined
type Context = { session?: SessionLike; auth?: Pick<HttpContext, 'auth'>['auth'] }

const positive = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0

/** Starts impersonation bound to the target, so the marker is useless to anyone else. */
export function beginImpersonation(session: SessionLike, adminId: number, targetId: number) {
  session?.put(IMPERSONATOR_KEY, { adminId, targetId })
}

/** Drops the marker; every sign-out path calls this. */
export function endImpersonation(session: SessionLike) {
  session?.forget(IMPERSONATOR_KEY)
}

/**
 * The active impersonation, only when the signed-in user is its target. A marker
 * left behind for anyone else (for example after a sign-out on a shared browser)
 * is discarded instead of being trusted.
 */
export function activeImpersonation(ctx: Context): Impersonation | null {
  const raw = ctx.session?.get(IMPERSONATOR_KEY) as Partial<Impersonation> | undefined
  if (raw === undefined || raw === null) return null
  const userId = ctx.auth?.user?.id
  if (
    typeof raw === 'object' &&
    positive(raw.adminId) &&
    positive(raw.targetId) &&
    userId !== undefined &&
    raw.targetId === userId
  )
    return { adminId: raw.adminId!, targetId: raw.targetId! }
  endImpersonation(ctx.session)
  return null
}

/** Whether any marker is present, valid or not; used to refuse nested impersonation. */
export function hasImpersonationMarker(session: SessionLike) {
  const raw = session?.get(IMPERSONATOR_KEY)
  return raw !== undefined && raw !== null
}

/** The user who really acted: the administrator while impersonating, else the user. */
export function acting(ctx: Context & { auth: Pick<HttpContext, 'auth'>['auth'] }) {
  return activeImpersonation(ctx)?.adminId ?? ctx.auth.getUserOrFail().id
}
