import db from '@adonisjs/lucid/services/db'
import { ActorStore, ResourceService, SavedViews } from '@adula/kit'
import { registry } from '#start/modules'
import cache from '@adonisjs/cache/services/main'
import type { Actor } from '@adula/kit'

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
