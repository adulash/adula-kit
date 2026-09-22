import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, relative, isAbsolute } from 'node:path'
const kit = resolve(fileURLToPath(new URL('../packages/kit', import.meta.url)))
const target = resolve(kit, 'build')
const inside = relative(kit, target)
if (inside !== 'build' || isAbsolute(inside)) throw new Error('Refusing to remove a non-build directory')
await rm(target, { recursive: true, force: true })
