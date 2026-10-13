import { packRules } from '@casl/ability/extra'
import { buildAbility, type Actor, type Rule } from './ability.js'
import type { Resource } from '../resource/types.js'

/** UI hints only. Organizational scope and every mutation are enforced on the server. */
export function packedResourceRules(resource: Resource, actor: Actor) {
  const rules: Rule[] = actor.rules
    .filter((rule) => rule.subject === resource.name || rule.subject === 'all')
    .map((rule) => ({ ...rule, subject: resource.name }))
  const forbidden = Object.keys(resource.fields).filter(
    (key) =>
      actor.permissionLevel <
      Math.max(resource.fields[key].permissionLevel ?? 0, resource.hidden?.includes(key) ? 1 : 0)
  )
  if (forbidden.length)
    rules.push({ subject: resource.name, action: 'manage', fields: forbidden, inverted: true })
  return packRules(buildAbility(rules).rules)
}
