import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../registry/theme.css', import.meta.url), 'utf8')
const block = (selector) => css.match(new RegExp(`${selector} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

test('inline theme values are variables that the project brand.css can override', () => {
  // `@theme inline` copies literals into utilities, where brand.css cannot reach them (issue #23).
  const inline = block('@theme inline')
  assert.ok(inline.includes('--color-ring: var(--ring);'))
  assert.doesNotMatch(inline, /#[\da-f]{3,8}\b/i)
  assert.match(inline, /--font-sans: var\(--brand-font, 'Noto Sans Arabic'\), sans-serif;/)
  const defaults = block(':root')
  for (const token of new Set([...inline.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1])))
    assert.match(defaults, new RegExp(`--${token}: `), `missing default for --${token}`)
})

test('registry components compose the registry Select instead of native lists', async () => {
  // A native list opens in OS styling, ignores the theme and RTL layout (issue #39).
  const { readdir } = await import('node:fs/promises')
  const dir = new URL('../registry/ui/', import.meta.url)
  for (const name of await readdir(dir))
    if (name.endsWith('.tsx'))
      assert.doesNotMatch(await readFile(new URL(name, dir), 'utf8'), /<select[\s>]/, name)
})
