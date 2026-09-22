import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/redis'
import type { InferConnections } from '@adonisjs/redis/types'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD'),
      // Parallel test runs isolate themselves with REDIS_TEST_DB (default 15).
      db: app.inTest ? Number(process.env.REDIS_TEST_DB ?? 15) : 0,
      keyPrefix: '',
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => (attempt > 10 ? null : attempt * 100),
    },
  },
})
export default redisConfig
declare module '@adonisjs/redis/types' {
  interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
