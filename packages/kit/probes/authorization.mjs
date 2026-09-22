import { createSqlInterpreter, allInterpreters, pg } from '@ucast/sql'
import knex from 'knex'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const connection = process.env.TEST_DATABASE_URL ?? JSON.parse(await readFile(new URL('../../../.work/test-database.json', import.meta.url), 'utf8'))
const db = knex({ client: 'pg', connection })
const compile = createSqlInterpreter(allInterpreters)
const dialect = { ...pg, paramPlaceholder: () => '?' }
const cases = []
try {
  for (const condition of [
    { operator: 'eq', field: 'value', value: null },
    { operator: 'ne', field: 'value', value: 'alpha' },
    { operator: 'in', field: 'value', value: [null, 'alpha'] },
    { operator: 'like', field: 'value', value: 'a%' },
  ]) {
    try {
      const [sql, parameters] = compile(condition, dialect)
      const result = await db.raw(`SELECT value FROM (VALUES ('alpha'::text), (NULL::text), ('beta'::text)) r(value) WHERE ${sql}`, parameters)
      cases.push({ operator: condition.operator, sql, matched: result.rows.map((r) => r.value) })
    } catch (error) { cases.push({ operator: condition.operator, error: error.message }) }
  }
  let queryPlan
  await db.transaction(async (trx) => {
    await trx.raw('CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public')
    await trx.raw('CREATE TEMP TABLE kit_ltree_probe (id int, path ltree) ON COMMIT DROP')
    await trx.raw("INSERT INTO kit_ltree_probe SELECT n, ('1.' || ((n-1)/1000+1)::text || '.' || n::text)::ltree FROM generate_series(1,100000) n")
    await trx.raw('CREATE INDEX kit_ltree_probe_gist ON kit_ltree_probe USING gist(path)')
    await trx.raw('ANALYZE kit_ltree_probe')
    const result = await trx.raw("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM kit_ltree_probe WHERE path <@ '1.42'::ltree")
    queryPlan = result.rows[0]['QUERY PLAN'][0]
  })
  const report = { measuredAt: new Date().toISOString(), node: process.version, ucast: '0.2.0', cases, ltree: { rows: 100000, plan: queryPlan }, decision: 'Use the explicit compiler: SQL NULL semantics must match the kit matcher, LIKE must be supported, and unsupported operators must fail closed.' }
  await mkdir(new URL('../../../docs/evidence', import.meta.url), { recursive: true })
  await writeFile(new URL('../../../docs/evidence/authorization-probes.json', import.meta.url), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await db.destroy() }
