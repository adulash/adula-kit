import app from '@adonisjs/core/services/app'
import { defineConfig } from '@nemoventures/adonis-jobs'
import type { InferQueues } from '@nemoventures/adonis-jobs/types'

const queueConfig = defineConfig({
  connection: { connectionName: 'main' },
  // Own connections keep cache/Redis shutdown from interrupting queue cleanup.
  useSharedConnection: false,
  defaultPrefix: app.inTest ? 'adula-reference-test' : 'adula-reference',
  defaultQueue: 'events',
  healthCheck: { enabled: false },
  queues: {
    events: {
      defaultWorkerOptions: { concurrency: 4 },
      defaultJobOptions: {
        attempts: 10,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 604800 },
        removeOnFail: false,
      },
    },
  },
})
export default queueConfig
declare module '@nemoventures/adonis-jobs/types' {
  interface Queues extends InferQueues<typeof queueConfig> {}
}
