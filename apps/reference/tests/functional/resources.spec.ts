import { resourceContract } from '#tests/helpers/resource_contract'
import { registry } from '#start/modules'
import { resourceFixtures } from '#tests/helpers/resource_fixtures'
for (const resource of registry.all()) {
  const fixture = resourceFixtures[resource.name]
  if (!fixture) throw new Error(`Missing HTTP contract fixture for ${resource.name}`)
  resourceContract(resource.name, fixture)
}
