import { Ability, subject, fieldPatternMatcher } from '@casl/ability'
import type { Conditions } from './conditions.js'
import { conditionsMatcher, predicates } from './conditions.js'
import type { RecordData, Resource } from '../resource/types.js'

export type Rule = {
  subject: string
  action: string | string[]
  conditions?: Conditions
  fields?: string[]
  inverted?: boolean
}
export type Actor = { id: number; orgPaths: string[]; permissionLevel: number; rules: Rule[] }
export type KitAbility = Ability<[string, any], Conditions>
export const abilitySchemas = new WeakMap<
  KitAbility,
  readonly Pick<Resource, 'name' | 'fields'>[]
>()

export function buildAbility(
  rules: readonly Rule[],
  schemas: readonly Pick<Resource, 'name' | 'fields'>[] = []
): KitAbility {
  for (const rule of rules) {
    predicates(rule.conditions)
    if (rule.fields?.length === 0) throw new Error('An empty fields rule is invalid')
  }
  const ability: KitAbility = new Ability(
    [...rules.filter((r) => !r.inverted), ...rules.filter((r) => r.inverted)],
    {
      conditionsMatcher: (conditions) => conditionsMatcher(conditions, schemas),
      fieldMatcher: fieldPatternMatcher,
    }
  )
  abilitySchemas.set(ability, schemas)
  return ability
}

export function inOrgScope(path: unknown, paths: readonly string[]) {
  return (
    typeof path === 'string' &&
    paths.some((parent) => path === parent || path.startsWith(`${parent}.`))
  )
}
export function canRecord(
  ability: KitAbility,
  actor: Actor,
  resource: Resource,
  action: string,
  record: RecordData,
  field?: string
) {
  return (
    (!resource.scoped || inOrgScope(record.orgPath, actor.orgPaths)) &&
    ability.can(action, subject(resource.name, record), field)
  )
}
export function conditionFields(ability: KitAbility, resource: Resource): string[] {
  return [
    ...new Set(
      ability.rules
        .filter((r) => r.subject === resource.name || r.subject === 'all')
        .flatMap((r) => Object.keys(r.conditions ?? {}))
    ),
  ]
}
