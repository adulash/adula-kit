import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
import { modules, fixtureModuleNames } from '#start/modules'

export default defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      pool: { min: 0, max: 10 },
      migrations: {
        naturalSort: true,
        paths: [
          'database/migrations',
          'node_modules/@adula/kit/build/database/migrations',
          ...modules.map(
            (module) =>
              `${fixtureModuleNames.has(module.name) ? 'tests/fixtures/modules' : 'app/modules'}/${module.name}/migrations`
          ),
        ],
      },
    },
  },
})
