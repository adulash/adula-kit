import { writeFile } from 'node:fs/promises'
import { capabilityCatalog } from '../src/commands/capabilities.js'

// Regenerates the catalog shipped in the package (agent/capabilities.md).
await writeFile(new URL('../agent/capabilities.md', import.meta.url), capabilityCatalog())
console.log('agent/capabilities.md regenerated')
