import { test } from '@japa/runner'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { assessUploadSize, diagnoseUi, diagnoseUploads } from '../src/commands/doctor.js'
import { digest } from '../src/commands/agent_assets.js'
import { KIT_VERSION } from '../src/version.js'

test.group('Doctor filesystem diagnostics', (group) => {
  let root: string
  group.each.setup(async () => {
    root = await mkdtemp(join(tmpdir(), 'adula-doctor-'))
  })
  group.each.teardown(async () => {
    const local = relative(tmpdir(), root)
    if (isAbsolute(local) || local.startsWith('..') || !local.startsWith('adula-doctor-'))
      throw new Error('Refusing to remove a path outside the doctor test directory')
    await rm(root, { recursive: true, force: true })
  })
  const put = async (file: string, content: string) => {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), content)
  }
  const component = 'inertia/components/ui/button.tsx'
  const original = 'export const Button = () => null\n'
  const installUi = async (compatibility = KIT_VERSION.split('.').slice(0, 2).join('.')) => {
    await put(component, original)
    await put(
      'ui.lock.json',
      JSON.stringify({
        version: KIT_VERSION,
        kitCompatibility: compatibility,
        files: { [component]: { hash: digest(original), component: 'button' } },
      })
    )
  }

  test('reports absent and empty uploads separately from an unknown measurement', async ({
    assert,
  }) => {
    const absent = await diagnoseUploads(root)
    assert.equal(absent.status, 'pass')
    assert.include(absent.message, 'does not exist')
    await mkdir(join(root, 'storage/uploads'), { recursive: true })
    const empty = await diagnoseUploads(root)
    assert.equal(empty.status, 'pass')
    assert.include(empty.message, '0 bytes')
  })

  test('sums nested file sizes without counting unrelated storage files', async ({ assert }) => {
    await put('storage/uploads/document.txt', 'hello')
    await put('storage/uploads/2026/contract.txt', 'world!')
    await put('storage/uploads/2026/empty.txt', '')
    await put('storage/not-an-upload.txt', 'do not count this')
    const result = await diagnoseUploads(root)
    assert.equal(result.status, 'pass')
    assert.include(result.message, '11 bytes')
    assert.equal(await readFile(join(root, 'storage/uploads/document.txt'), 'utf8'), 'hello')
  })

  test('warns strictly above 5 decimal GB and recommends migration without removing files', ({
    assert,
  }) => {
    assert.equal(assessUploadSize(5_000_000_000).status, 'pass')
    const large = assessUploadSize(5_000_000_001)
    assert.equal(large.status, 'warn')
    assert.include(large.message, '5000000001 bytes')
    assert.include(large.message, 'S3 migration')
    assert.include(large.message, 'verify the uploaded files')
  })

  test('does not report a successful measurement when uploads is not a directory', async ({
    assert,
  }) => {
    await put('storage/uploads', 'invalid upload directory')
    const result = await diagnoseUploads(root)
    assert.equal(result.status, 'warn')
    assert.include(result.message, 'Size is unknown')
  })

  test('does not follow upload directory links or recurse into a linked cycle', async ({
    assert,
  }) => {
    await mkdir(join(root, 'storage/uploads'), { recursive: true })
    await symlink(join(root, 'storage/uploads'), join(root, 'storage/uploads/loop'), 'junction')
    const result = await diagnoseUploads(root)
    assert.equal(result.status, 'warn')
    assert.include(result.message, 'symbolic links')
  })

  test('does not follow a parent directory link outside the application root', async ({
    assert,
  }) => {
    const app = join(root, 'consumer')
    await mkdir(app)
    await mkdir(join(root, 'outside/uploads'), { recursive: true })
    await symlink(join(root, 'outside'), join(app, 'storage'), 'junction')
    const result = await diagnoseUploads(app)
    assert.equal(result.status, 'warn')
  })

  test('unchanged copied UI does not claim that page compatibility has been proven', async ({
    assert,
  }) => {
    await installUi()
    await put('inertia/pages/orders/index.tsx', 'export default () => null\n')
    const result = await diagnoseUi(root)
    assert.isTrue(result.every((finding) => finding.status === 'pass'))
    assert.include(
      result.find((finding) => finding.check === 'ui.pages')!.message,
      'still requires typecheck and page tests'
    )
  })

  test('changed copies trigger a conservative review of ordinary and module page sources', async ({
    assert,
  }) => {
    await installUi()
    const custom = original + '// Project-owned customization\n'
    const page =
      '// This page uses a wrapper; no direct component import\nexport default () => null\n'
    await put(component, custom)
    await put('inertia/pages/orders/index.tsx', page)
    await put('app/modules/orders/pages/orders/show.tsx', page)
    await put('app/modules/orders/models/order.ts', '// This is not a page\n')
    const beforeLock = await readFile(join(root, 'ui.lock.json'), 'utf8')
    const result = await diagnoseUi(root)
    const pages = result.find((finding) => finding.check === 'ui.pages')!
    assert.equal(result.find((finding) => finding.check === 'ui.customizations')!.status, 'warn')
    assert.equal(pages.status, 'warn')
    assert.include(pages.message, component)
    assert.include(pages.message, 'inertia/pages/orders/index.tsx')
    assert.include(pages.message, 'app/modules/orders/pages/orders/show.tsx')
    assert.notInclude(pages.message, 'models/order.ts')
    assert.include(pages.message, 'not import dependency analysis')
    assert.equal(await readFile(join(root, component), 'utf8'), custom)
    assert.equal(await readFile(join(root, 'inertia/pages/orders/index.tsx'), 'utf8'), page)
    assert.equal(await readFile(join(root, 'ui.lock.json'), 'utf8'), beforeLock)
  })

  test('a kit compatibility mismatch requires page review even when copy hashes still match', async ({
    assert,
  }) => {
    await installUi('999.0')
    await put('inertia/pages/orders/index.tsx', 'export default () => null\n')
    const result = await diagnoseUi(root)
    assert.equal(result.find((finding) => finding.check === 'ui.compatibility')!.status, 'fail')
    assert.equal(result.find((finding) => finding.check === 'ui.customizations')!.status, 'pass')
    assert.equal(result.find((finding) => finding.check === 'ui.pages')!.status, 'warn')
  })

  test('changed UI with unavailable page sources requires review in the source checkout', async ({
    assert,
  }) => {
    await installUi()
    await put(component, original + '// changed\n')
    const findings = await diagnoseUi(root)
    const pages = findings.find((finding) => finding.check === 'ui.pages')!
    assert.equal(pages.status, 'warn')
    assert.include(pages.message, 'source checkout')
    assert.include(pages.message, 'No page sources found')
  })

  test('linked page sources do not produce an incomplete inventory presented as complete', async ({
    assert,
  }) => {
    await installUi()
    await put(component, original + '// changed\n')
    await put('outside/index.tsx', 'export default () => null\n')
    await symlink(join(root, 'outside'), join(root, 'inertia/pages'), 'junction')
    const findings = await diagnoseUi(root)
    const pages = findings.find((finding) => finding.check === 'ui.pages')!
    assert.equal(pages.status, 'warn')
    assert.include(pages.message, 'could not be completely inventoried')
  })

  test('missing and unsafe UI locks cannot produce successful compatibility findings', async ({
    assert,
  }) => {
    const missing = await diagnoseUi(root)
    assert.deepEqual(
      missing.map((finding) => finding.status),
      ['fail']
    )
    await installUi()
    const lock = JSON.parse(await readFile(join(root, 'ui.lock.json'), 'utf8'))
    lock.files['../outside.tsx'] = { hash: digest(original), component: 'outside' }
    await put('ui.lock.json', JSON.stringify(lock))
    const result = await diagnoseUi(root)
    assert.deepEqual(
      result.map((finding) => finding.status),
      ['fail']
    )
    assert.equal(result[0].check, 'ui.registry')
  })

  test('does not read UI component contents through a directory linked outside the consumer', async ({
    assert,
  }) => {
    await installUi()
    await put('consumer/ui.lock.json', await readFile(join(root, 'ui.lock.json'), 'utf8'))
    await mkdir(join(root, 'consumer/inertia/components'), { recursive: true })
    await symlink(
      join(root, 'inertia/components/ui'),
      join(root, 'consumer/inertia/components/ui'),
      'junction'
    )
    const findings = await diagnoseUi(join(root, 'consumer'))
    assert.deepEqual(
      findings.map((finding) => finding.status),
      ['fail']
    )
  })
})
