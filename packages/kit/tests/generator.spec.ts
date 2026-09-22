import { test } from '@japa/runner'
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generateResource } from '../src/commands/generator.js'

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
    assert.include(modules, 'existing , module_examples,')
    assert.include(module, 'resource_default, resource_next,')
    assert.include(module, "import resource_default from './resources/default.js'")
  })
})
