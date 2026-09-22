import app from '@adonisjs/core/services/app'
import { defineConfig, store, drivers } from '@adonisjs/cache'
import type { InferStores } from '@adonisjs/cache/types'

const cacheConfig = defineConfig({
  default: 'redis',
  prefix: app.inTest ? 'adula-reference-test' : 'adula-reference',
  ttl: '5m',
  stores: {
    redis: store()
      .useL1Layer(drivers.memory())
      .useL2Layer(drivers.redis({ connectionName: 'main' })),
  },
})
export default cacheConfig
declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> {}
}
