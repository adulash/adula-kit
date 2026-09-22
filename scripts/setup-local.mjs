import { readFile, writeFile, access } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../apps/reference/package.json', import.meta.url))
const { Client } = require('pg')
const connection = JSON.parse(await readFile(new URL('../.work/test-database.json', import.meta.url), 'utf8'))
const client = new Client({ ...connection, database: 'postgres' })
await client.connect()
for (const name of ['adula_test', 'adula_reference']) {
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])
  if (!exists.rowCount) await client.query(`CREATE DATABASE ${name}`)
}
await client.end()
const example = await readFile(new URL('../apps/reference/.env.example', import.meta.url), 'utf8')
for (const [file, name, mode] of [['.env', 'adula_reference', 'development'], ['.env.test', 'adula_test', 'test']]) {
  try { await access(new URL(`../apps/reference/${file}`, import.meta.url)); continue } catch {}
  let env = example.replace(/^APP_KEY=.*$/m, `APP_KEY=${randomBytes(32).toString('base64url')}`).replace(/^DB_PORT=.*$/m, `DB_PORT=${connection.port}`).replace(/^DB_USER=.*$/m, `DB_USER=${connection.user}`).replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${connection.password}`).replace(/^DB_DATABASE=.*$/m, `DB_DATABASE=${name}`).replace(/^NODE_ENV=.*$/m, `NODE_ENV=${mode}`)
  env = env.replace(/^REDIS_PORT=.*$/m, 'REDIS_PORT=16379')
  if (mode === 'test') env = env.replace(/^PORT=.*$/m, 'PORT=3334').replace(/^APP_URL=.*$/m, 'APP_URL=http://127.0.0.1:3334')
  await writeFile(new URL(`../apps/reference/${file}`, import.meta.url), env)
}
console.log('Created isolated reference/test databases and untracked environment files.')
