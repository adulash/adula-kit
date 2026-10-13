import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, relative, isAbsolute } from 'node:path'
const core = resolve(fileURLToPath(new URL('../packages/adula', import.meta.url)))
const target = resolve(core, 'build')
const inside = relative(core, target)
if (inside !== 'build' || isAbsolute(inside)) throw new Error('Refusing to remove a non-build directory')
await rm(target, { recursive: true, force: true })
