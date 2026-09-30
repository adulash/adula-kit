import { test } from '@japa/runner'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import {
  assessUploadSize,
  diagnoseOutbox,
  diagnoseResourceSnapshots,
  diagnoseUi,
  diagnoseUploads,
  diagnoseWorkflowRoles,
} from '../src/commands/doctor.js'
import { defineWorkflow } from '../src/workflows/define_workflow.js'
import { generateResource } from '../src/commands/generator.js'
import {
  embeddedResource,
  resourceSnapshot,
  rewriteResourceSnapshot,
} from '../src/commands/snapshot.js'
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

test.group('Doctor resource migration snapshots', () => {
  test('reports a pending create-migration that no longer matches its resource', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-snapshot-'))
    await mkdir(join(root, 'start'))
    await writeFile(
      join(root, 'start/modules.ts'),
      '// adula:imports\nexport const modules = [/* adula:modules */]\n'
    )
    const files = await generateResource(root, 'task', 'projects')
    const file = files.find((path) => path.includes('/migrations/'))!
    const pending = [{ file, source: await readFile(join(root, file), 'utf8') }]
    const title = {
      type: 'string',
      label: { ar: 'العنوان', en: 'Title' },
      required: true,
      searchable: true,
    }
    const scaffolded = { name: 'task', scoped: true, fields: { title } }
    assert.equal(diagnoseResourceSnapshots(pending, () => scaffolded).status, 'pass')
    // The developer followed the scaffold message and filled the definition (issue #20).
    const filled = {
      ...scaffolded,
      fields: {
        title,
        status: { type: 'lookup', group: 'task_status', label: title.label, required: true },
        dueDate: { type: 'date', label: title.label },
        notes: { type: 'hasMany', resource: 'note', foreignKey: 'taskId', label: title.label },
      },
    }
    const drift = diagnoseResourceSnapshots(pending, (name) =>
      name === 'task' ? filled : undefined
    )
    assert.equal(drift.status, 'warn')
    assert.include(drift.message, `${file} (task): status (lookup, required); due_date (date)`)
    assert.notInclude(drift.message, 'notes')
    const removed = diagnoseResourceSnapshots(pending, () => ({ ...scaffolded, fields: {} }))
    assert.include(removed.message, 'without title (string, required, searchable)')
    // Unknown resources and hand-written migrations are not guessed at.
    assert.equal(diagnoseResourceSnapshots(pending, () => undefined).status, 'pass')
    const manual = [{ file, source: 'await createResourceTable(db, resource)' }]
    assert.equal(diagnoseResourceSnapshots(manual, () => filled).status, 'pass')
  })

  test('adula:resource:snapshot rewrites a pending migration from the current definition', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-snapshot-'))
    await mkdir(join(root, 'start'))
    await writeFile(
      join(root, 'start/modules.ts'),
      '// adula:imports\nexport const modules = [/* adula:modules */]\n'
    )
    const files = await generateResource(root, 'task', 'projects')
    const file = files.find((path) => path.includes('/migrations/'))!
    const source = await readFile(join(root, file), 'utf8')
    assert.equal(embeddedResource(source), 'task')
    const label = { ar: 'حقل', en: 'Field' }
    const filled = {
      name: 'task',
      scoped: true,
      submittable: true,
      version: true,
      fields: {
        title: { type: 'string', label, required: true, searchable: true },
        project: { type: 'belongsTo', resource: 'project', label, required: true },
        status: { type: 'lookup', group: 'task_status', label },
        code: { type: 'string', label, sequence: 'TSK', unique: true },
        notes: { type: 'hasMany', resource: 'note', foreignKey: 'taskId', label },
      },
    } as never
    const rewritten = rewriteResourceSnapshot(source, resourceSnapshot(filled))
    // Only the embedded definition changes; the migration class around it stays.
    assert.include(rewritten, "import { createResourceTable } from '@adula/kit'")
    assert.include(rewritten, 'async down()')
    assert.notInclude(rewritten, '"notes"')
    const pending = [{ file, source: rewritten }]
    assert.equal(diagnoseResourceSnapshots(pending, () => filled).status, 'pass')
    assert.throws(
      () =>
        rewriteResourceSnapshot(
          source,
          resourceSnapshot({ ...(filled as object), name: 'other' } as never)
        ),
      /does not embed the other definition/
    )
    assert.isUndefined(embeddedResource('await createResourceTable(db, resource)'))
    await rm(root, { recursive: true, force: true })
  })
})

test.group('Doctor workflow role references', () => {
  test('lists workflow steps whose role name matches no role', ({ assert }) => {
    const flow = defineWorkflow({
      name: 'release_approval',
      version: 2,
      resource: 'release',
      label: 'x',
      start: 'review',
      steps: {
        review: {
          type: 'approval',
          label: 'مراجعة',
          assignees: { role: 'مدير مشروع' },
          approve: 'tell',
          reject: 'done',
        },
        tell: { type: 'notify', to: { role: 'المطورون' }, next: 'done' },
        done: { type: 'end', outcome: 'completed' },
      },
    })
    const ok = diagnoseWorkflowRoles([flow], ['مدير مشروع', 'المطورون'])
    assert.equal(ok.status, 'pass')
    // An administrator renamed the role in the roles screen (issue #25).
    const renamed = diagnoseWorkflowRoles([flow], ['مدير المشروع', 'المطورون'])
    assert.equal(renamed.status, 'warn')
    assert.include(renamed.message, 'release_approval@2.review → "مدير مشروع"')
    assert.notInclude(renamed.message, 'tell')
    // With keys known, a reference by display name still works but is fragile.
    const keyed = diagnoseWorkflowRoles(
      [flow],
      [
        { key: 'project_manager', name: 'مدير مشروع' },
        { key: null, name: 'المطورون' },
      ]
    )
    assert.equal(keyed.status, 'warn')
    assert.include(keyed.message, 'by display name')
    assert.include(keyed.message, 'release_approval@2.tell → "المطورون"')
    assert.notInclude(keyed.message, 'match no role')
    const byKey = defineWorkflow({
      ...flow,
      steps: {
        ...flow.steps,
        review: { ...flow.steps.review, assignees: { role: 'project_manager' } } as never,
        tell: { type: 'notify', to: { role: 'developers' }, next: 'done' },
      },
    })
    assert.equal(
      diagnoseWorkflowRoles(
        [byKey],
        [
          { key: 'project_manager', name: 'مدير المشروع' },
          { key: 'developers', name: 'المطورون' },
        ]
      ).status,
      'pass'
    )
  })
  test('outbox check warns when events wait longer than a minute', ({ assert }) => {
    const worker = (healthy: boolean) => ({
      worker: { at: null, ageMs: null, healthy },
    })
    const fresh = diagnoseOutbox({
      outbox: { backlog: 3, oldestAgeMs: 5_000 },
      heartbeats: worker(true),
    })
    assert.equal(fresh.status, 'pass')
    // Development ran only the HTTP server, so 210 events never reached listeners (#50).
    const stuck = diagnoseOutbox({
      outbox: { backlog: 210, oldestAgeMs: 3_600_000 },
      heartbeats: worker(false),
    })
    assert.equal(stuck.status, 'warn')
    assert.include(stuck.message, '210 unpublished events')
    assert.include(stuck.message, 'not running')
    assert.include(stuck.message, 'adula:worker')
    const empty = diagnoseOutbox({
      outbox: { backlog: 0, oldestAgeMs: null },
      heartbeats: worker(false),
    })
    assert.equal(empty.status, 'pass')
  })
})
