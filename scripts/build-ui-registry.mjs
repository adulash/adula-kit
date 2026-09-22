import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../packages/ui/', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const registry = JSON.parse(await readFile(new URL('registry.json', root), 'utf8'))
const dependencies = JSON.parse(await readFile(new URL('dependencies.json', root), 'utf8'))
await mkdir(new URL('build/', root), { recursive: true })
const items = []
for (const entry of registry.items) {
  const files = await Promise.all(entry.files.map(async (file) => {
    const content = await readFile(new URL(file.path, root), 'utf8')
    return { ...file, content, target: `inertia/components/ui/${file.path.split('/').at(-1)}` }
  }))
  const item = { ...entry, files, $schema: 'https://ui.shadcn.com/schema/registry-item.json' }
  await writeFile(new URL(`build/${entry.name}.json`, root), JSON.stringify(item, null, 2) + '\n')
  items.push({ name: entry.name, version: pkg.version,
    hash: createHash('sha256').update(JSON.stringify(item)).digest('hex') })
}
await cp(new URL('registry/theme.css', root), new URL('build/theme.css', root))
await writeFile(new URL('build/manifest.json', root), JSON.stringify({
  // Derived so a minor release actually signals a compatibility review in doctor.
  version: pkg.version, kitCompatibility: pkg.version.split('.').slice(0, 2).join('.'), items, dependencies,
}, null, 2) + '\n')
console.log(`Built ${items.length} RTL registry items (${pkg.version})`)
