import { cp, mkdir } from 'node:fs/promises'
const base = new URL('../packages/kit/', import.meta.url)
for (const dir of ['agent', 'stubs']) {
  await mkdir(new URL(`build/${dir}`, base), { recursive: true })
  await cp(new URL(dir, base), new URL(`build/${dir}`, base), { recursive: true })
}
await cp(new URL('src/eslint', base), new URL('build/src/eslint', base), { recursive: true })
