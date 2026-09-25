import assert from 'node:assert/strict'
import test from 'node:test'
import { compare } from '../../scripts/check-api.mjs'

const base = { '.': { a: { kind: 'FunctionDeclaration', type: '() => void' }, T: { kind: 'TypeAliasDeclaration', type: 'string' } } }

test('removed or changed exports are breaking; new ones are additions', () => {
  assert.deepEqual(compare(base, base), { breaking: [], added: [] })
  const next = { '.': { a: { kind: 'FunctionDeclaration', type: '(x: number) => void' }, b: { kind: 'VariableDeclaration', type: 'number' } } }
  assert.deepEqual(compare(base, next), { breaking: ['. a: changed', '. T: removed'], added: ['. b'] })
})
