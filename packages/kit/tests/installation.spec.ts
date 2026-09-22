import { test } from '@japa/runner'
import { mkdtemp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { syncAgentAssets, managedRules, agentAssets, digest } from '../src/commands/agent_assets.js'
import { diagnoseAgentSkills } from '../src/commands/doctor.js'
import { withKitDatabase } from '../src/database/configure.js'

test.group('Independent installation contracts', () => {
  test('agent updates preserve project rules and detect malformed boundaries before writing', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-install-'))
    const rules = '## Project rules\nKeep our own deployment and custom pages.\n'
    await writeFile(join(root, 'AGENTS.md'), rules)
    await syncAgentAssets(root)
    const installed = await readFile(join(root, 'AGENTS.md'), 'utf8')
    assert.include(installed, rules)
    assert.isNotEmpty(managedRules(installed))
    await syncAgentAssets(root)
    assert.equal(await readFile(join(root, 'AGENTS.md'), 'utf8'), installed)
    const lock = JSON.parse(await readFile(join(root, 'adula.lock.json'), 'utf8'))
    assert.match(lock.skills['.agents/skills/adula-idea-review/SKILL.md'], /^[a-f0-9]{64}$/)
    const malformed = '<!-- adula-kit:start -->\nUser content without an end marker'
    await writeFile(join(root, 'AGENTS.md'), malformed)
    await assert.rejects(() => syncAgentAssets(root), /Malformed/)
    assert.equal(await readFile(join(root, 'AGENTS.md'), 'utf8'), malformed)
  })
  test('ships every managed skill, repairs missing or modified skills and preserves company identity', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-design-'))
    const identity = '# Company identity\nUser-supplied logo: public/brand/company.svg\n'
    const customSkill = '# Project-owned workflow\n'
    await mkdir(join(root, 'docs'), { recursive: true })
    await mkdir(join(root, '.agents/skills/project-workflow'), { recursive: true })
    await writeFile(join(root, 'docs/design-identity.md'), identity)
    await writeFile(join(root, '.agents/skills/project-workflow/SKILL.md'), customSkill)
    await syncAgentAssets(root)
    const assets = await agentAssets()
    const designPath = '.agents/skills/adula-frontend-design/SKILL.md'
    assert.include(Object.keys(assets.skills), designPath)
    const lock = JSON.parse(await readFile(join(root, 'adula.lock.json'), 'utf8'))
    for (const [path, content] of Object.entries(assets.skills)) {
      assert.equal(await readFile(join(root, path), 'utf8'), content)
      assert.equal(lock.skills[path], digest(content))
    }
    const expectStatus = async (status: 'pass' | 'fail') => {
      const finding = await diagnoseAgentSkills(root)
      assert.equal(finding.status, status)
    }
    await expectStatus('pass')
    await writeFile(join(root, designPath), 'Modified design instructions')
    await expectStatus('fail')
    await syncAgentAssets(root)
    await expectStatus('pass')
    await unlink(join(root, designPath))
    await expectStatus('fail')
    await syncAgentAssets(root)
    await expectStatus('pass')
    assert.equal(await readFile(join(root, 'docs/design-identity.md'), 'utf8'), identity)
    assert.equal(
      await readFile(join(root, '.agents/skills/project-workflow/SKILL.md'), 'utf8'),
      customSkill
    )
  })
  test('migration discovery preserves connection settings and stable relative paths', async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-migrations-'))
    await mkdir(join(root, 'app/modules/orders/migrations'), { recursive: true })
    const config = {
      connection: 'postgres',
      connections: {
        postgres: {
          client: 'pg' as const,
          connection: { database: 'sample' },
          migrations: { paths: ['database/migrations', 'project/migrations'] },
        },
      },
    }
    const configured = withKitDatabase(config, root)
    assert.deepEqual(
      configured.connections.postgres.connection,
      config.connections.postgres.connection
    )
    assert.deepEqual(configured.connections.postgres.migrations.paths, [
      'database/migrations',
      'project/migrations',
      'node_modules/@adula/kit/build/database/migrations',
      'app/modules/orders/migrations',
    ])
    assert.deepEqual(withKitDatabase(configured, root), configured)
    assert.lengthOf(config.connections.postgres.migrations.paths, 2)
    assert.throws(
      () => withKitDatabase({ connection: 'sqlite', connections: {} }, root),
      /PostgreSQL/
    )
  })
})
