import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../packages/ui/', import.meta.url)
const registry = JSON.parse(await readFile(new URL('registry.json', root), 'utf8'))
const dependencies = JSON.parse(await readFile(new URL('dependencies.json', root), 'utf8'))
Object.assign(dependencies, { '@tanstack/react-table': '9.2.4', '@tanstack/react-virtual': '3.14.13', axios: '1.19.0' })
const pin = (name) => `${name}@${dependencies[name]}`
const components = {
  'can': { registry: [], npm: [] },
  'resource-value': { registry: ['badge'], npm: ['lucide-react'] },
  'resource-actions': { registry: ['button', 'dialog', 'can'], npm: ['axios', 'sonner'] },
  'resource-field': {
    registry: ['input', 'textarea', 'button', 'label', 'select', 'switch', 'popover', 'calendar', 'command', 'resource-value'],
    npm: ['axios', 'date-fns', 'lucide-react'],
  },
  'data-table': {
    registry: ['button', 'input', 'badge', 'can', 'resource-actions', 'resource-field', 'resource-value'],
    npm: ['@tanstack/react-table', '@tanstack/react-virtual', 'axios', 'lucide-react'],
  },
  'resource-form': {
    registry: ['button', 'alert', 'label', 'resource-actions', 'resource-field', 'resource-value'],
    npm: ['axios', 'sonner', 'lucide-react'],
  },
  'resource-show': {
    registry: ['button', 'badge', 'skeleton', 'can', 'resource-actions', 'resource-value'],
    npm: ['lucide-react'],
  },
  'resource-surface': { registry: ['button', 'dialog'], npm: [] },
  'resource-page': { registry: ['button', 'data-table', 'resource-form', 'resource-show', 'resource-surface'], npm: ['lucide-react'] },
}
for (const [name, { registry: registryDependencies, npm }] of Object.entries(components)) {
  const entry = { name, type: 'registry:ui', registryDependencies, dependencies: npm.map(pin),
    files: [{ path: `registry/ui/${name}.tsx`, type: 'registry:ui' }] }
  const index = registry.items.findIndex((item) => item.name === name)
  if (index === -1) registry.items.push(entry)
  else registry.items[index] = entry
}
await writeFile(new URL('registry.json', root), JSON.stringify(registry, null, 2) + '\n')
await writeFile(new URL('dependencies.json', root), JSON.stringify(dependencies, null, 2) + '\n')
