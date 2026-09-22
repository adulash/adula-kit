import { ResourceRegistry, type Module } from '@adula/kit'
import { testFixturesEnabled } from '#start/test_fixtures'
// adula:imports
export const modules: Module[] = [/* adula:modules */]
export const fixtureModuleNames = new Set<string>()
if (testFixturesEnabled) {
  const { fixtureModules } = await import('#tests/fixtures/modules')
  for (const module of fixtureModules) fixtureModuleNames.add(module.name)
  modules.push(...fixtureModules)
}
export const registry = new ResourceRegistry().register(modules)
