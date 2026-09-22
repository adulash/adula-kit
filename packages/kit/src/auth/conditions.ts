import type { Scalar, RecordData, Resource } from '../resource/types.js'
import { columnName } from '../resource/define_resource.js'

export type Operator = '$eq' | '$ne' | '$in' | '$lt' | '$gt' | '$like'
export type Conditions = Record<string, Scalar | Partial<Record<Operator, Scalar | Scalar[]>>>
export type Predicate = { field: string; operator: Operator; value: Scalar | Scalar[] }
const operators = new Set(['$eq', '$ne', '$in', '$lt', '$gt', '$like'])
const scalar = (v: unknown): v is Scalar =>
  v === null ||
  ['string', 'boolean'].includes(typeof v) ||
  (typeof v === 'number' && Number.isFinite(v))

export function predicates(conditions: Conditions = {}, fields?: Set<string>): Predicate[] {
  if (!conditions || Array.isArray(conditions) || typeof conditions !== 'object')
    throw new Error('Conditions must be an object')
  return Object.entries(conditions).flatMap(([field, condition]) => {
    columnName(field)
    if (fields && !fields.has(field)) throw new Error(`Unknown condition field: ${field}`)
    const ops = scalar(condition) ? { $eq: condition } : condition
    if (!ops || Array.isArray(ops) || typeof ops !== 'object' || !Object.keys(ops).length)
      throw new Error(`Invalid condition: ${field}`)
    return Object.entries(ops).map(([operator, value]) => {
      if (!operators.has(operator)) throw new Error(`Unsupported condition operator: ${operator}`)
      if (operator === '$in' ? !Array.isArray(value) || !value.every(scalar) : !scalar(value))
        throw new Error(`Invalid operand: ${operator}`)
      if (operator === '$like' && typeof value !== 'string')
        throw new Error('$like requires a string')
      if (['$lt', '$gt'].includes(operator) && !['string', 'number'].includes(typeof value))
        throw new Error(`${operator} requires a number or string`)
      return { field, operator: operator as Operator, value: value as Scalar | Scalar[] }
    })
  })
}

// SQL LIKE semantics: % and _ are wildcards, backslash is a literal character.
export function likePattern(value: string) {
  return new RegExp(
    `^${[...value].map((c) => (c === '%' ? '[\\s\\S]*' : c === '_' ? '[\\s\\S]' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')}$`,
    'u'
  )
}

// This matcher is used exclusively by CASL. SQL compilation shares the validated AST.
export function conditionsMatcher(
  conditions: Conditions,
  schemas: readonly Pick<Resource, 'name' | 'fields'>[] = []
) {
  const parts = predicates(conditions)
  return (record: RecordData) =>
    parts.every(({ field, operator, value }) => {
      const actual = record[field] ?? null
      const type = schemas.find((schema) => schema.name === record.__caslSubjectType__)?.fields[
        field
      ]?.type
      const compare = () => {
        if (type === 'money') {
          if (
            typeof actual !== 'string' ||
            typeof value !== 'string' ||
            !/^(0|-?[1-9]\d*)$/.test(actual) ||
            !/^(0|-?[1-9]\d*)$/.test(value)
          )
            return undefined
          const left = BigInt(actual)
          const right = BigInt(value)
          return left < right ? -1 : left > right ? 1 : 0
        }
        if (typeof actual !== typeof value || actual === null) return undefined
        if (typeof actual === 'string' && typeof value === 'string') {
          const left = [...actual].map((point) => point.codePointAt(0)!)
          const right = [...value].map((point) => point.codePointAt(0)!)
          for (let index = 0; index < Math.min(left.length, right.length); index++)
            if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1
          return Math.sign(left.length - right.length)
        }
        return (actual as number) < (value as number)
          ? -1
          : (actual as number) > (value as number)
            ? 1
            : 0
      }
      switch (operator) {
        case '$eq':
          return actual === value
        case '$ne':
          return actual !== value
        case '$in':
          return (value as Scalar[]).includes(actual as Scalar)
        case '$lt':
          return compare() === -1
        case '$gt':
          return compare() === 1
        case '$like':
          return typeof actual === 'string' && likePattern(value as string).test(actual)
      }
    })
}
