// Explicit external acceptance entrypoint; the ordinary suite never contacts S3.
import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import { configure, run } from '@japa/runner'

if (
  process.env.ADULA_S3_ACCEPTANCE !== '1' ||
  !/^adula_s3_\d+_(source|restored)_test$/.test(process.env.DB_DATABASE ?? '')
)
  throw new Error('Run this acceptance test through pnpm test:s3')

process.env.NODE_ENV = 'test'
const root = new URL('../../', import.meta.url)
new Ignitor(root, { importer: (path) => import(path) })
  .tap((app) =>
    app.booting(async () => {
      await import('#start/env')
    })
  )
  .testRunner()
  .configure(async (app) => {
    const { runnerHooks, ...config } = await import('../bootstrap.js')
    const { default: cache } = await import('@adonisjs/cache/services/main')
    configure({
      ...config,
      suites: [
        { name: 'functional', files: ['tests/acceptance/s3_files.spec.ts'], timeout: 240000 },
      ],
      setup:
        process.env.ADULA_S3_PHASE === 'restored'
          ? [
              async () => {
                await cache.clear()
              },
            ]
          : runnerHooks.setup,
      teardown: runnerHooks.teardown.concat([() => app.terminate()]),
    })
  })
  .run(() => run())
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
