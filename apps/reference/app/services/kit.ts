import db from '@adonisjs/lucid/services/db'
import {
  ActorStore,
  Assignments,
  RecordCollaboration,
  ResourceService,
  SavedViews,
  Webhooks,
  ImportBatches,
} from '@adula/kit'
import app from '@adonisjs/core/services/app'
import encryption from '@adonisjs/core/services/encryption'
import { registry } from '#start/modules'
import cache from '@adonisjs/cache/services/main'
import type { Actor } from '@adula/kit'
import type { HttpContext } from '@adonisjs/core/http'

/** Session key holding the administrator's id while they act as another user. */
export const IMPERSONATOR_KEY = 'impersonator_id'

export function kit() {
  const knex = db.connection().getWriteClient()
  const resources = new ResourceService(knex, registry)
  const actors = new ActorStore(knex, registry, {
    get: async (key) => (await cache.get<Actor>({ key })) ?? undefined,
    set: async (key, value) => {
      await cache.set({ key, value, ttl: '5m' })
    },
  })
  return {
    registry,
    resources,
    savedViews: new SavedViews(knex, registry),
    actors,
    collaboration: new RecordCollaboration(knex, resources, actors),
    assignments: new Assignments(knex, resources, actors),
    imports: new ImportBatches(knex, registry, resources, actors),
    webhooks: new Webhooks(
      knex,
      registry,
      {
        seal: (value) => encryption.encrypt(value),
        open: (value) => encryption.decrypt<string>(value),
      },
      // Private and plain-HTTP targets are only reachable outside production.
      { allowPrivateTargets: !app.inProduction }
    ),
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
