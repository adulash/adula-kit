import type { Field } from './types.js'

export function canonicalDate(value: unknown, type: 'date' | 'datetime') {
  if (typeof value !== 'string') return false
  const normalized = type === 'date' ? `${value}T00:00:00.000Z` : value
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(normalized) &&
    !normalized.startsWith('0000') &&
    Number.isFinite(Date.parse(normalized)) &&
    new Date(normalized).toISOString() === normalized
  )
}
export function canonicalMoney(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(0|-?[1-9]\d*)$/.test(value) || value.length > 20)
    return false
  const integer = BigInt(value)
  return integer >= -9223372036854775808n && integer <= 9223372036854775807n
}
function isJson(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value)) return false
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false
  // JSON.stringify changes holes into null; never silently alter a submitted value.
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++)
      if (!Object.hasOwn(value, index)) return false
  }
  ancestors.add(value)
  const valid = Object.values(value).every((entry) => isJson(entry, ancestors))
  ancestors.delete(value)
  return valid
}

/** Normalize before CASL evaluates a prospective record, using its stored representation. */
export function fieldValue(field: Field, value: unknown): unknown {
  if (value === undefined || value === null) return value
  switch (field.type) {
    case 'money': {
      const amount =
        typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value
      if (!canonicalMoney(amount))
        throw new Error(
          'Money requires canonical integer minor units within PostgreSQL bigint range'
        )
      return amount
    }
    case 'integer':
    case 'belongsTo':
      if (
        !Number.isInteger(value) ||
        Number(value) < (field.type === 'belongsTo' ? 1 : -2147483648) ||
        Number(value) > 2147483647
      )
        throw new Error('Expected a PostgreSQL integer')
      return value
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error('Expected a boolean')
      return value
    case 'string':
    case 'text':
    case 'lookup':
      if (typeof value !== 'string') throw new Error('Expected a string')
      return value
    case 'date':
    case 'datetime': {
      const normalized =
        field.type === 'datetime' && value instanceof Date && Number.isFinite(value.getTime())
          ? value.toISOString()
          : value
      if (!canonicalDate(normalized, field.type))
        throw new Error('Expected a valid ISO date or canonical UTC timestamp')
      return normalized
    }
    case 'json':
      if (!isJson(value)) throw new Error('Expected a JSON value without cycles or non-JSON values')
      return value
    case 'attachment':
      // Writes carry the id of an owned upload; reads are hydrated into summaries later.
      if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2147483647)
        throw new Error('Expected the identifier of an uploaded attachment')
      return value
    default:
      return value
  }
}
