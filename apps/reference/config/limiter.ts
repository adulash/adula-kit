import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * Tests always use the in-process store so parallel suites never share
 * counters and a suite can reset them between tests; LIMITER_STORE only
 * selects the store outside tests.
 */
const limiterConfig = defineConfig({
  default: app.inTest ? 'memory' : (env.get('LIMITER_STORE') ?? 'redis'),
  stores: {
    redis: stores.redis({ connectionName: 'main' }),
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
