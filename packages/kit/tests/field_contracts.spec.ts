import { test } from '@japa/runner'
import { unpackRules } from '@casl/ability/extra'
import { subject } from '@casl/ability'
import { buildAbility, packedResourceRules } from '../index.js'
import { selectedFields } from '../src/admin/contracts.js'
import { order, reader } from './helpers.js'
import type { Rule } from '../index.js'

test('read projection includes condition fields but excludes unrelated form-only values', ({
  assert,
}) => {
  const resource = {
    ...order,
    fields: {
      ...order.fields,
      secret: { type: 'string' as const, label: { ar: 'سري', en: 'Secret' } },
    },
    form: [...order.form, 'secret'],
  }
  const ability = buildAbility([
    { subject: 'orders', action: 'view', conditions: { status: 'open' } },
  ])
  assert.notInclude(selectedFields(resource, ability), 'secret')
  assert.include(selectedFields(resource, ability), 'status')
  assert.include(selectedFields(resource, ability, { write: true }), 'secret')
  assert.notInclude(selectedFields(resource, ability), 'lines')
})

test('packed UI rules contain only the current resource and retain field denials', ({ assert }) => {
  const rules = unpackRules<Rule>(packedResourceRules(order, reader))
  assert.deepEqual([...new Set(rules.flatMap((rule) => rule.subject))], ['orders'])
  const ability = buildAbility(rules)
  assert.isTrue(ability.can('view', subject('orders', { orgPath: '1.2' }), 'notes'))
  assert.isFalse(ability.can('view', subject('orders', { orgPath: '1.2' }), 'total'))
  assert.isFalse(ability.can('update', subject('orders', { orgPath: '1.2' }), 'internalNote'))
  assert.isFalse(ability.can('view', 'customers'))
})
