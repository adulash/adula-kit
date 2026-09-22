import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import type { Settings } from '../services/settings.js'
import { KIT_VERSION } from '../version.js'
import { agentAssets, managedRules, digest } from './agent_assets.js'

export type Finding = {
  check: string
  status: 'pass' | 'warn' | 'fail' | 'info'
  message: string
}

// The deployment volume and backup scripts share this application-relative path.
const UPLOADS_PATH = 'storage/uploads'
const UPLOADS_WARNING_BYTES = 5_000_000_000

async function assertContained(root: string, path: string) {
  const resolved = relative(await realpath(root), await realpath(path))
  if (
    resolved === '..' ||
    resolved.startsWith('../') ||
    resolved.startsWith('..\\') ||
    isAbsolute(resolved)
  )
    throw new Error('Path resolves outside the application')
}

async function visitFiles(
  root: string,
  directory: string,
  visit: (path: string, bytes: number) => Promise<void> | void
): Promise<boolean> {
  const path = join(root, directory)
  try {
    await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  await assertContained(root, path)
  const walk = async (current: string): Promise<void> => {
    const entry = await lstat(current)
    if (entry.isSymbolicLink()) throw new Error('Symbolic links require manual inspection')
    if (entry.isFile()) {
      await visit(relative(root, current).replaceAll('\\', '/'), entry.size)
      return
    }
    if (!entry.isDirectory()) throw new Error('Unsupported filesystem entry')
    const children = await readdir(current)
    for (const child of children.sort()) await walk(join(current, child))
  }
  const entry = await lstat(path)
  if (!entry.isDirectory()) throw new Error('Expected a directory')
  await walk(path)
  return true
}

export function assessUploadSize(bytes: number): Finding {
  const large = bytes > UPLOADS_WARNING_BYTES
  return {
    check: 'storage.uploads',
    status: large ? 'warn' : 'pass',
    message: `${UPLOADS_PATH} contains ${bytes} bytes (${(bytes / 1_000_000_000).toFixed(2)} GB); ${
      large
        ? 'above 5 GB, plan an S3 migration and verify the uploaded files before removing local copies'
        : 'within the 5 GB local-storage warning threshold'
    }`,
  }
}

export async function diagnoseUploads(root: string): Promise<Finding> {
  try {
    let bytes = 0
    const exists = await visitFiles(root, UPLOADS_PATH, (_path, size) => {
      bytes += size
    })
    return exists
      ? assessUploadSize(bytes)
      : {
          check: 'storage.uploads',
          status: 'pass',
          message: `${UPLOADS_PATH} does not exist; no local uploads volume to measure`,
        }
  } catch {
    return {
      check: 'storage.uploads',
      status: 'warn',
      message: `Cannot completely measure ${UPLOADS_PATH}; check permissions, directory structure and symbolic links. Size is unknown`,
    }
  }
}

async function diagnosePages(root: string, changed: string[]): Promise<Finding> {
  if (!changed.length)
    return {
      check: 'ui.pages',
      status: 'pass',
      message:
        'No copied UI drift detected; page compatibility still requires typecheck and page tests',
    }
  const pages: string[] = []
  const collect = (file: string) => {
    if (/\.[jt]sx$/.test(file)) pages.push(file)
  }
  try {
    await visitFiles(root, 'inertia/pages', collect)
    // Module-local page overrides are also project-owned extension points.
    await visitFiles(root, 'app/modules', (file) => {
      if (/^app\/modules\/[^/]+\/pages\//.test(file)) collect(file)
    })
  } catch {
    return {
      check: 'ui.pages',
      status: 'warn',
      message: `UI review required (${changed.join('; ')}), but page sources could not be completely inventoried. Check source permissions and symbolic links, then run typecheck and page tests`,
    }
  }
  return {
    check: 'ui.pages',
    status: 'warn',
    message: `UI review required (${changed.join('; ')}). ${
      pages.length
        ? `Review all ${pages.length} project-owned page sources: ${pages.sort().join(', ')}`
        : 'No page sources found in inertia/pages or app/modules/*/pages; review overrides in the source checkout'
    }. This is a conservative inventory, not import dependency analysis; run typecheck and page tests`,
  }
}

export async function diagnoseUi(root: string): Promise<Finding[]> {
  try {
    const lock = JSON.parse(await readFile(join(root, 'ui.lock.json'), 'utf8'))
    if (
      typeof lock.version !== 'string' ||
      typeof lock.kitCompatibility !== 'string' ||
      !lock.files ||
      typeof lock.files !== 'object' ||
      Array.isArray(lock.files)
    )
      throw new Error('Invalid UI lock')
    const compatible = lock.kitCompatibility === KIT_VERSION.split('.').slice(0, 2).join('.')
    const customized: string[] = []
    for (const [file, entry] of Object.entries(lock.files) as [string, { hash: string }][]) {
      if (
        !/^inertia\/components\/ui\/[a-z][a-z0-9_-]*\.tsx?$/.test(file) ||
        !entry ||
        typeof entry.hash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.hash)
      )
        throw new Error('Invalid UI lock entry')
      const path = join(root, file)
      await assertContained(root, path)
      const info = await lstat(path)
      if (!info.isFile()) throw new Error('UI component must be a regular file')
      if (digest(await readFile(path, 'utf8')) !== entry.hash) customized.push(file)
    }
    const changes = [
      ...(!compatible ? ['UI registry compatibility differs from this kit version'] : []),
      ...(customized.length ? [`copied UI changed: ${customized.sort().join(', ')}`] : []),
    ]
    return [
      {
        check: 'ui.compatibility',
        status: compatible ? 'pass' : 'fail',
        message: compatible
          ? 'UI registry is compatible with this kit version'
          : 'UI registry version requires a compatibility review',
      },
      {
        check: 'ui.customizations',
        status: customized.length ? 'warn' : 'pass',
        message: customized.length
          ? `${customized.length} project-owned UI files are customized; review diffs before updates`
          : 'UI files match the installed registry snapshot',
      },
      await diagnosePages(root, changes),
    ]
  } catch {
    return [
      {
        check: 'ui.registry',
        status: 'fail',
        message: 'UI lock or component files are missing or invalid; run adula:ui add all',
      },
    ]
  }
}

export async function diagnoseAgentSkills(root: string): Promise<Finding> {
  let valid = false
  try {
    const assets = await agentAssets()
    const lock = JSON.parse(await readFile(join(root, 'adula.lock.json'), 'utf8'))
    valid = lock.version === KIT_VERSION && lock.managedRules === digest(assets.rules)
    for (const [skillPath, content] of Object.entries(assets.skills)) {
      const actual = await readFile(join(root, skillPath), 'utf8')
      valid =
        valid && lock.skills?.[skillPath] === digest(content) && digest(actual) === digest(content)
    }
  } catch {
    valid = false
  }
  return {
    check: 'agent.skills',
    status: valid ? 'pass' : 'fail',
    message: valid
      ? 'Managed skill hashes match this kit version'
      : 'Run adula:install to synchronize managed rules and skills',
  }
}

export async function diagnose(
  root: string,
  settings: Settings,
  production: boolean,
  env: Record<string, string | undefined>,
  now = Date.now()
): Promise<Finding[]> {
  const findings: Finding[] = []
  findings.push(await diagnoseUploads(root))
  const version = await settings.get<string>('kit.version')
  findings.push({
    check: 'kit.version',
    status: version === KIT_VERSION ? 'pass' : 'fail',
    message:
      version === KIT_VERSION
        ? `Kit ${KIT_VERSION} is installed`
        : 'Run adula:install after migrations; installed kit version differs',
  })
  const template = await readFile(
    new URL('../../agent/AGENTS.template.md', import.meta.url),
    'utf8'
  )
  let agents = ''
  try {
    agents = await readFile(join(root, 'AGENTS.md'), 'utf8')
  } catch {}
  const managed = managedRules
  findings.push({
    check: 'agent.rules',
    status: managed(agents) === managed(template) ? 'pass' : 'fail',
    message:
      managed(agents) === managed(template)
        ? 'Managed rules match'
        : 'Managed AGENTS.md was changed or is missing',
  })
  const keys = [
    'BACKUP_S3_ENDPOINT',
    'BACKUP_S3_BUCKET',
    'BACKUP_S3_REGION',
    'BACKUP_S3_ACCESS_KEY_ID',
    'BACKUP_S3_SECRET_ACCESS_KEY',
  ]
  const configured = keys.every((key) => Boolean(env[key]))
  findings.push({
    check: 'backup.config',
    status: configured ? 'pass' : production ? 'fail' : 'warn',
    message: configured ? 'Offsite settings are present' : 'Offsite backup is not configured',
  })
  for (const [key, maxDays] of [
    ['backup.lastOffsite', 2],
    ['backup.lastRestoreTest', 90],
  ] as const) {
    const date = await settings.get<string>(key)
    const fresh =
      date &&
      Number.isFinite(Date.parse(date)) &&
      now - Date.parse(date) >= 0 &&
      now - Date.parse(date) < maxDays * 86400000
    findings.push({
      check: key,
      status: fresh ? 'pass' : production ? 'fail' : 'warn',
      message: fresh ? `${key} is current` : `${key} is missing or older than ${maxDays} days`,
    })
  }
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  findings.push({
    check: 'boundaries',
    status:
      pkg.dependencies?.['patch-package'] ||
      pkg.devDependencies?.['patch-package'] ||
      pkg.pnpm?.patchedDependencies
        ? 'fail'
        : 'pass',
    message: 'Application may not patch kit internals',
  })
  findings.push(await diagnoseAgentSkills(root))
  if (pkg.dependencies?.['@adula/ui'] || pkg.devDependencies?.['@adula/ui'])
    findings.push(...(await diagnoseUi(root)))
  return findings
}
