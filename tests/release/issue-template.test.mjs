import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { checkIssue, missingSections, requiredLabels } from '../../scripts/check-issue-template.mjs'

const form = (name) => readFile(new URL(`../../.github/ISSUE_TEMPLATE/${name}`, import.meta.url), 'utf8')
const render = (sections) =>
  Object.entries(sections)
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join('\n\n')

test('required labels come from the issue forms', async () => {
  assert.deepEqual(requiredLabels(await form('gap.yml')), [
    'Package',
    'Needed by',
    'Tried',
    'Blocked because',
    'Proposed kit change',
    'Reproduction',
    'Acceptance',
  ])
  assert.deepEqual(requiredLabels(await form('bug.yml')), [
    'Package',
    'Reproduction',
    'Expected',
    'Actual',
    'Acceptance',
    'Environment',
  ])
})

test('an issue submitted through the gap form passes, with an empty optional field', async () => {
  const body = render({
    Package: '@adula/kit 1.0.0',
    'Needed by': 'Per-record upload grants.',
    Tried: 'Role rules.',
    'Blocked because': 'POST /attachments checks resource-wide rules only.',
    'Proposed kit change': 'attachments.grant().',
    Reproduction: '1. create-app\n2. upload from a module page',
    Acceptance: 'A PostgreSQL test.',
    Workaround: '_No response_',
  })
  assert.deepEqual(await checkIssue(body), { form: 'gap.yml', missing: [] })
})

test('a free-form issue is reported with the missing sections of the closest form', async () => {
  const body = '**Type:** Bug\n\n## Steps to reproduce\n\n1. run it\n\n### Expected\n\nit works'
  const result = await checkIssue(body)
  assert.equal(result.form, undefined)
  assert.equal(result.closest, 'bug.yml')
  assert.deepEqual(result.missing, ['Package', 'Reproduction', 'Actual', 'Acceptance', 'Environment'])
})

test('an empty or unanswered required section counts as missing', () => {
  assert.deepEqual(missingSections('### Package\n\n_No response_\n\n### Tried\n\n', ['Package', 'Tried']), [
    'Package',
    'Tried',
  ])
  assert.deepEqual(missingSections(null, ['Package']), ['Package'])
})
