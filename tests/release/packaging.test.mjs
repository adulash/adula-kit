import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateManifest, validateContents, validateReadiness } from '../../scripts/check-release.mjs'

const kit = JSON.parse(await readFile(new URL('../../packages/kit/package.json', import.meta.url), 'utf8'))
const readiness = JSON.parse(await readFile(new URL('../../docs/release-readiness.json', import.meta.url), 'utf8'))
const accepted = () => ({ target: '1.0.0', version: '1.0.0', phases: Array.from({ length: 8 }, (_, id) => ({ id, status: 'accepted', reviewedBy: 'test reviewer', reviewedAt: '2026-09-19', evidence: [`docs/evidence/phase-${id}.md`] })) })

test('refuses a package with the wrong provenance destination or local dependency', () => {
  validateManifest(kit, '@adula/kit', kit.version)
  assert.throws(() => validateManifest({ ...kit, repository: { ...kit.repository, url: 'git+https://github.com/other/repo.git' } }, kit.name, kit.version), /repository mismatch/)
  assert.throws(() => validateManifest({ ...kit, dependencies: { ...kit.dependencies, helper: 'workspace:*' } }, kit.name, kit.version), /local dependency/)
})

test('refuses private files and archives missing executable exports', () => {
  assert.throws(() => validateContents(kit, ['package/.env.production']), /Private file/)
  assert.throws(() => validateContents(kit, ['package/build/tests/authorization.js']), /Private source/)
  assert.throws(() => validateContents(kit, ['package/../private']), /Unsafe archive/)
  assert.throws(() => validateContents(kit, ['package/package.json', 'package/README.md']), /Required package file missing/)
})

test('current implementation cannot be published as stable or mislabeled next', () => {
  assert.throws(() => validateReadiness(readiness, kit.version, 'latest'), /completed 1.0.0/)
  assert.throws(() => validateReadiness(readiness, kit.version, 'next'), /prerelease version|Phase [01] acceptance/)
})

test('alpha authorizes only an explicit owner-selected preview and never accepts later channels', () => {
  const value = structuredClone(readiness)
  value.version = '0.2.0-alpha.1'
  value.alpha = { version: value.version, authorized: true, reviewedBy: 'test owner', reviewedAt: '2026-09-22', evidence: ['docs/evidence/alpha-decision.json'] }
  assert.deepEqual(validateReadiness(value, value.version, 'alpha'), value.alpha.evidence)
  assert.throws(() => validateReadiness(value, value.version, 'latest'))
  assert.throws(() => validateReadiness(value, value.version, 'next'))
  value.alpha.version = '0.2.0-alpha.2'
  assert.throws(() => validateReadiness(value, value.version, 'alpha'), /exact version/)
  value.alpha.version = value.version
  value.alpha.authorized = false
  assert.throws(() => validateReadiness(value, value.version, 'alpha'), /authorization/)
  value.alpha.authorized = true
  value.alpha.evidence = ['docs/evidence/../../secret']
  assert.throws(() => validateReadiness(value, value.version, 'alpha'), /Invalid evidence/)
})

test('stable release requires every phase and dated evidence', () => {
  assert.equal(validateReadiness(accepted(), '1.0.0', 'latest').length, 8)
  for (let id = 0; id < 8; id++) {
    const value = accepted()
    value.phases[id].status = 'pending'
    assert.throws(() => validateReadiness(value, '1.0.0', 'latest'), /incomplete/)
  }
  const missing = accepted()
  missing.phases.pop()
  assert.throws(() => validateReadiness(missing, '1.0.0', 'latest'), /Every acceptance phase/)
  const undocumented = accepted()
  undocumented.phases[2].evidence = []
  assert.throws(() => validateReadiness(undocumented, '1.0.0', 'latest'), /needs evidence/)
  const traversal = accepted()
  traversal.phases[0].evidence = ['docs/evidence/../../secret']
  assert.throws(() => validateReadiness(traversal, '1.0.0', 'latest'), /Invalid evidence path/)
})

test('next remains available for the phase 2 slice only after early acceptance', () => {
  const value = accepted()
  value.version = '0.3.0-next.0'
  value.phases[2].status = 'pending'
  assert.equal(validateReadiness(value, value.version, 'next').length, 2)
  value.phases[1].status = 'pending'
  assert.throws(() => validateReadiness(value, value.version, 'next'), /Phase 1/)
})
