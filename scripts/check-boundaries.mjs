import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
const errors = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules','build','.work','.git','.adonisjs'].includes(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (entry.name === 'package.json') {
      const json = JSON.parse(await readFile(path, 'utf8'))
      if (json.dependencies?.['patch-package'] || json.devDependencies?.['patch-package'] || json.pnpm?.patchedDependencies) errors.push(`${path}: kit patching is forbidden`)
      if (json.license !== 'MIT') errors.push(`${path}: MIT license is required`)
    }
  }
}
await walk('apps'); await walk('packages')
for (const line of errors) console.error(line)
if (errors.length) process.exitCode = 1
else console.log('Package ownership and license checks passed.')
