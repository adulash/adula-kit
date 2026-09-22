import type { Field, Resource, ResourceInput } from './types.js'

export function identifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`)
  return value
}
export function columnName(name: string): string {
  return identifier(name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
}
export function defineResource<const F extends Record<string, Field>>(
  input: ResourceInput<F>
): ResourceInput<F> & Resource {
  identifier(input.name)
  if (typeof input.scoped !== 'boolean') throw new Error(`${input.name}: scoped must be explicit`)
  if (!input.label.ar || !input.label.en) throw new Error('Bilingual labels are required')
  for (const [key, field] of Object.entries(input.fields)) {
    columnName(key)
    identifier(field.column ?? columnName(key))
    if (
      [
        'id',
        'orgUnitId',
        'createdBy',
        'updatedBy',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'version',
        'docStatus',
        'amendedFromId',
      ].includes(key)
    )
      throw new Error(`Reserved field: ${key}`)
    if (!field.label.ar || !field.label.en) throw new Error(`${key}: bilingual labels are required`)
  }
  for (const keys of [
    input.list,
    input.form,
    input.show,
    input.hidden ?? [],
    input.serialize ?? [],
  ]) {
    for (const key of keys) if (!(key in input.fields)) throw new Error(`Unknown field: ${key}`)
  }
  if (!input.submittable && input.actions.some((a) => ['submit', 'cancel', 'amend'].includes(a)))
    throw new Error('Document actions require submittable')
  return Object.freeze({ ...input, version: input.version ?? input.submittable ?? false })
}
