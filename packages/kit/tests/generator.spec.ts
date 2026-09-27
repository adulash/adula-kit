import { test } from '@japa/runner'
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generateResource } from '../src/commands/generator.js'
import { appendMarkedItem } from '../src/commands/source_markers.js'

test.group('Resource generator', () => {
  test('generates and registers resource without overwriting existing files', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-generator-'))
    await mkdir(join(root, 'start'))
    await writeFile(
      join(root, 'start/modules.ts'),
      '// adula:imports\nexport const modules = [/* adula:modules */]\n'
    )
    const files = await generateResource(root, 'samples', 'examples')
    assert.lengthOf(files, 6)
    for (const file of files) await access(join(root, file))
    const module = await readFile(join(root, 'app/modules/examples/module.ts'), 'utf8')
    assert.include(module, "import resource_samples from './resources/samples.js'")
    assert.include(
      await readFile(
        join(
          root,
          files.find((p) => p.includes('migrations'))!
        ),
        'utf8'
      ),
      'createResourceTable'
    )
    await assert.rejects(
      () => generateResource(root, 'samples', 'examples'),
      /Refusing to overwrite/
    )
    assert.equal(await readFile(join(root, 'app/modules/examples/module.ts'), 'utf8'), module)
    await assert.rejects(() => generateResource(root, '../escape', 'examples'), /Unsafe/)
  })
  test('appends to populated arrays and accepts SQL names that are JS keywords', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-generator-'))
    await mkdir(join(root, 'start'))
    await writeFile(
      join(root, 'start/modules.ts'),
      '// adula:imports\nexport const modules = [existing /* adula:modules */]\n'
    )
    await generateResource(root, 'default', 'examples')
    await generateResource(root, 'next', 'examples')
    const modules = await readFile(join(root, 'start/modules.ts'), 'utf8')
    const module = await readFile(join(root, 'app/modules/examples/module.ts'), 'utf8')
    // One item per line with the marker last: the layout Prettier keeps stable (issue #21).
    assert.include(modules, '[\n  existing,\n  module_examples,\n  /* adula:modules */\n]')
    assert.include(
      module,
      '  resources: [\n    resource_default,\n    resource_next,\n    /* adula:resources */\n  ],'
    )
    assert.include(module, "import resource_default from './resources/default.js'")
  })
  test('normalizes single-line marker lists and refuses lists it cannot rewrite safely', ({
    assert,
  }) => {
    const marker = '/* adula:modules */'
    const expected = 'export const modules = [\n  a,\n  b,\n  /* adula:modules */\n]\n'
    for (const list of [
      '[a, /* adula:modules */]',
      '[a /* adula:modules */]',
      '[a,/* adula:modules */ ]',
    ])
      assert.equal(appendMarkedItem(`export const modules = ${list}\n`, marker, 'b'), expected)
    assert.equal(
      appendMarkedItem(appendMarkedItem('x = [/* adula:modules */]', marker, 'a'), marker, 'b'),
      'x = [\n  a,\n  b,\n  /* adula:modules */\n]'
    )
    assert.throws(
      () => appendMarkedItem('x = [f(a, b), /* adula:modules */]', marker, 'c'),
      /by hand/
    )
    assert.throws(() => appendMarkedItem('x = [a, /* adula:modules */, b]', marker, 'c'), /by hand/)
  })
})
