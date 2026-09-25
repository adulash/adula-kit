import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import * as kit from '../index.js'
import { CAPABILITY_SERVICES, FIELD_TYPES, capabilityCatalog } from '../index.js'
import { registry } from './helpers.js'

test.group('Capability catalog', () => {
  test('every listed service is a real public export', ({ assert }) => {
    for (const names of Object.values(CAPABILITY_SERVICES))
      for (const name of names) assert.property(kit, name, `${name} is not exported`)
  })

  test('field types match the schema generator', async ({ assert }) => {
    const schema = await readFile(new URL('../src/database/schema.ts', import.meta.url), 'utf8')
    for (const type of Object.keys(FIELD_TYPES).filter(
      (key) => !['string', 'hasMany', 'lookup'].includes(key)
    ))
      assert.include(schema, `case '${type}'`, `${type} has no storage mapping`)
  })

  test('lists the project registry, its workflows and the commands', ({ assert }) => {
    const catalog = capabilityCatalog({ registry, commands: ['adula:resource — Generate'] })
    assert.include(catalog, '### orders')
    assert.include(catalog, '`orders` (الطلبات; scoped, submittable)')
    assert.include(catalog, 'customerId:belongsTo→customers')
    assert.include(catalog, '- `adula:resource — Generate`')
    assert.include(catalog, 'Outside the kit')
  })

  test('the shipped catalog is regenerated from the code', async ({ assert }) => {
    const shipped = await readFile(new URL('../agent/capabilities.md', import.meta.url), 'utf8')
    assert.equal(shipped, capabilityCatalog(), 'Run: pnpm --filter @adula/kit capabilities')
  })
})
