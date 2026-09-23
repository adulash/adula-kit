import db from '@adonisjs/lucid/services/db'
import { ActorStore, ResourceService, SavedViews } from '@adula/kit'
import { registry } from '#start/modules'
import cache from '@adonisjs/cache/services/main'
import type { Actor } from '@adula/kit'
import type { HttpContext } from '@adonisjs/core/http'

/** Session key holding the administrator's id while they act as another user. */
export const IMPERSONATOR_KEY = 'impersonator_id'

export function kit() {
  const knex = db.connection().getWriteClient()
  return {
    registry,
    resources: new ResourceService(knex, registry),
    savedViews: new SavedViews(knex, registry),
    actors: new ActorStore(knex, registry, {
      get: async (key) => (await cache.get<Actor>({ key })) ?? undefined,
      set: async (key, value) => {
        await cache.set({ key, value, ttl: '5m' })
      },
    }),
  }
}

/** The signed-in actor; while impersonating, it also names the acting administrator. */
export async function requestActor(ctx: HttpContext): Promise<Actor> {
  const actor = await kit().actors.load(ctx.auth.getUserOrFail().id)
  const impersonator = Number(ctx.session?.get(IMPERSONATOR_KEY))
  return Number.isSafeInteger(impersonator) && impersonator > 0
    ? { ...actor, impersonatorId: impersonator }
    : actor
}
