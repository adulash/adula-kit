import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

const root = new URL('../../', import.meta.url)
const app = new Ignitor(root, { importer: (path) => import(path) }).createApp('console')
try {
  await app.init()
  await app.boot()
  const { modules, registry } = await import('#start/modules')
  const { listeners } = await import('#start/listeners')
  const { default: database } = await import('#config/database')
  console.log(
    'FIXTURE_PROBE:' +
      JSON.stringify({
        modules: modules.map((module) => module.name),
        resources: registry.all().map((resource) => resource.name),
        listeners: listeners.map((listener) => listener.name),
        migrations: database.connections.postgres.migrations?.paths,
      })
  )
} finally {
  await app.terminate()
}
