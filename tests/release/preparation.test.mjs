import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { releaseStatus } from '../../scripts/release-status.mjs'
import { requireSyntheticRehearsal } from '../../scripts/upgrade-mode.mjs'

test('release report exposes all pending phases even when version fails first', async () => {
  const report = await releaseStatus()
  assert.equal(report.channels.alpha.guardPassed, true)
  assert.equal(report.channels.next.guardPassed, false)
  assert.equal(report.channels.latest.guardPassed, false)
  assert.equal(report.phases.length, 8)
  assert.deepEqual(report.phases[1].requiredFor, ['next', 'latest'])
  assert.deepEqual(report.phases[2].requiredFor, ['latest'])
  assert.equal(report.publicationAuthorized, false)
})

test('a claimed acceptance with missing evidence still fails the actual guard', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adula-readiness-'))
  try {
    for (const name of ['kit', 'ui', 'create-app']) {
      await mkdir(join(root, 'packages', name), { recursive: true })
      const pkg = JSON.parse(await readFile(new URL(`../../packages/${name}/package.json`, import.meta.url)))
      pkg.version = '0.3.0-next.0'
      await writeFile(join(root, 'packages', name, 'package.json'), JSON.stringify(pkg))
    }
    await mkdir(join(root, 'docs'), { recursive: true })
    const readiness = { target: '1.0.0', version: '0.3.0-next.0', phases: Array.from({ length: 8 }, (_, id) => ({
      id, status: id <= 1 ? 'accepted' : 'pending', reviewedBy: 'test reviewer', reviewedAt: '2026-09-22',
      evidence: ['docs/evidence/missing.json'],
    })) }
    await writeFile(join(root, 'docs/release-readiness.json'), JSON.stringify(readiness))
    const report = await releaseStatus(root)
    assert.equal(report.channels.next.guardPassed, false)
    assert.match(report.channels.next.reason, /ENOENT/)
    await mkdir(join(root, 'docs/evidence'))
    await writeFile(join(root, 'docs/evidence/missing.json'), 'test-only evidence')
    assert.equal((await releaseStatus(root)).channels.next.guardPassed, true)
    assert.equal((await releaseStatus(root)).publicationAuthorized, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('synthetic upgrade requires explicit mode and cannot pretend to select a released version', () => {
  assert.throws(() => requireSyntheticRehearsal([], {}), /NOT release acceptance/)
  assert.throws(() => requireSyntheticRehearsal(['--synthetic'], { ADULA_PREVIOUS_VERSION: '0.1.0' }), /cannot select a published baseline/)
  assert.throws(() => requireSyntheticRehearsal(['--synthetic', '--real'], {}))
  assert.equal(requireSyntheticRehearsal(['--synthetic'], {}), '0.1.0')
})

test('upgrade entrypoint refuses a purported predecessor before changing package manifests', async () => {
  const script = fileURLToPath(new URL('../../scripts/test-upgrade.mjs', import.meta.url))
  const paths = ['kit', 'ui'].map((name) => new URL(`../../packages/${name}/package.json`, import.meta.url))
  const before = await Promise.all(paths.map((path) => readFile(path, 'utf8')))
  const run = spawnSync(process.execPath, [script, '--synthetic'], {
    env: { ...process.env, ADULA_PREVIOUS_VERSION: '0.1.0' }, encoding: 'utf8', windowsHide: true,
  })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /cannot select a published baseline/)
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path, 'utf8'))), before)
})
