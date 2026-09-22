import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const root = new URL('../packages/ui/', import.meta.url)
const names = ['button', 'input', 'textarea', 'select', 'checkbox', 'switch', 'radio-group', 'table', 'form', 'label', 'dialog', 'sheet', 'dropdown-menu', 'popover', 'command', 'calendar', 'badge', 'card', 'tabs', 'sonner', 'skeleton', 'pagination', 'tooltip', 'separator', 'alert']
await mkdir(new URL('registry/ui/', root), { recursive: true })
const items = []
const sources = []
for (const name of names) {
  const url = `https://ui.shadcn.com/r/styles/new-york-v4/${name}.json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  const item = await response.json()
  if (item.name !== name || !Array.isArray(item.files)) throw new Error(`Invalid registry response: ${name}`)
  const files = []
  for (const file of item.files) {
    const filename = file.path.split('/').at(-1)
    if (!/^[a-z][a-z0-9_-]*\.tsx?$/.test(filename)) throw new Error(`Unexpected upstream file: ${file.path}`)
    const path = `registry/ui/${filename}`
    await writeFile(new URL(path, root), file.content)
    sources.push({ name, url, path, sha256: createHash('sha256').update(file.content).digest('hex') })
    files.push({ path, type: file.type })
  }
  items.push({ ...item, files, $schema: undefined })
  console.log(`Fetched ${name}`)
}
await writeFile(new URL('registry.json', root), JSON.stringify({
  $schema: 'https://ui.shadcn.com/schema/registry.json', name: 'adula',
  homepage: 'https://www.npmjs.com/package/@adula/ui', items,
}, null, 2) + '\n')
await writeFile(new URL('UPSTREAM.json', root), JSON.stringify(sources, null, 2) + '\n')
const licenseResponse = await fetch('https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md')
if (!licenseResponse.ok) throw new Error(`License: HTTP ${licenseResponse.status}`)
await writeFile(new URL('LICENSE.shadcn.md', root), await licenseResponse.text())
console.log('Registry sources saved. Review dependencies, Arabic labels and RTL before building.')
