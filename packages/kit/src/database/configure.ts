import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseConfig } from '@adonisjs/lucid/types/database'

/** Migration names stay relative across source, packed and production installs. */
export function withKitDatabase<T extends DatabaseConfig>(config: T, root: string): T {
  const name = config.connection
  const connection = name ? config.connections[name] : undefined
  if (!connection || connection.client !== 'pg')
    throw new Error('adula-kit requires a configured PostgreSQL connection')
  let modules: string[] = []
  try {
    modules = readdirSync(join(root, 'app/modules'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9_]*$/.test(entry.name))
      .map((entry) => `app/modules/${entry.name}/migrations`)
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const migrations = connection.migrations ?? {}
  return {
    ...config,
    connections: {
      ...config.connections,
      [name!]: {
        ...connection,
        migrations: {
          ...migrations,
          naturalSort: true,
          paths: [
            ...new Set([
              ...(migrations.paths ?? ['database/migrations']),
              'node_modules/@adula/kit/build/database/migrations',
              ...modules,
            ]),
          ],
        },
      },
    },
  }
}
