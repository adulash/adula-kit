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

test('the accepted 1.0.0 passes the stable guard and cannot be relabeled as a prerelease', () => {
  const stable = { ...structuredClone(readiness), version: '1.0.0' }
  assert.ok(validateReadiness(stable, '1.0.0', 'latest').length >= 8)
  assert.throws(() => validateReadiness(stable, '1.0.0', 'next'), /prerelease version/)
  assert.throws(() => validateReadiness(stable, '1.0.0', 'alpha'), /alpha version/)
  const pending = structuredClone(stable)
  pending.phases[7].status = 'pending'
  assert.throws(() => validateReadiness(pending, '1.0.0', 'latest'), /incomplete/)
})

test('the recorded package version has a release record', () => {
  assert.equal(readiness.version, kit.version)
  if (kit.version !== readiness.target)
    assert.ok(readiness.releases.some((entry) => entry.version === kit.version))
})

test('a 1.x release after 1.0.0 needs the accepted phases and the owner authorizing that exact version', () => {
  const release = (version, change = {}) => ({
    ...accepted(),
    version,
    releases: [{ version, authorized: true, reviewedBy: 'test owner', reviewedAt: '2026-09-30', evidence: ['docs/evidence/release.json'], ...change }],
  })
  assert.equal(validateReadiness(release('1.2.0'), '1.2.0', 'latest').length, 9)
  assert.throws(() => validateReadiness(release('1.2.0', { authorized: false }), '1.2.0', 'latest'), /owner authorization/)
  assert.throws(() => validateReadiness(release('1.2.0', { version: '1.3.0' }), '1.2.0', 'latest'), /record in releases/)
  assert.throws(() => validateReadiness(release('1.2.0', { reviewedAt: '' }), '1.2.0', 'latest'), /dated owner decision/)
  assert.throws(() => validateReadiness(release('1.2.0', { evidence: [] }), '1.2.0', 'latest'), /needs evidence/)
  assert.throws(() => validateReadiness(release('1.2.0', { evidence: ['docs/evidence/../x'] }), '1.2.0', 'latest'), /Invalid evidence path/)
  assert.throws(() => validateReadiness(release('2.0.0'), '2.0.0', 'latest'), /1\.x releases only/)
  assert.throws(() => validateReadiness(release('1.2.0-rc.1'), '1.2.0-rc.1', 'latest'), /1\.x releases only/)
  const phase = release('1.2.0')
  phase.phases[3].status = 'pending'
  assert.throws(() => validateReadiness(phase, '1.2.0', 'latest'), /incomplete/)
})

test('alpha authorizes only an explicit owner-selected preview and never accepts later channels', () => {
  const value = structuredClone(readiness)
  value.version = '0.2.0-alpha.1'
  // An alpha preview is authorized while phases are still open.
  for (const phase of value.phases) phase.status = 'pending'
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
