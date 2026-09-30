import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import { GAP_FIELDS, GAPS_TEMPLATE, gapReport } from '../src/commands/gap_report.js'
import { getMetaData } from '../commands/main.js'

test.group('Gap report', () => {
  test('masks private details and lists gap titles', ({ assert }) => {
    const { masked, titles } = gapReport(
      [
        '# Kit gaps',
        '## GAP-001 — Webhooks for clinic.example.com',
        'Reported by owner@clinic.example from 10.20.30.40, see https://intranet.clinic.example/x.',
        '## GAP-002 — Printing',
      ].join('\n')
    )
    assert.deepEqual(titles, ['GAP-001 — Webhooks for clinic.example.com', 'GAP-002 — Printing'])
    assert.include(masked, 'Reported by <email> from <ip>, see <url>')
    for (const secret of ['owner@clinic.example', '10.20.30.40', 'https://intranet'])
      assert.notInclude(masked, secret)
  })

  test('builds a prefilled gap form link for each unreported gap', ({ assert }) => {
    const { gaps } = gapReport(
      [
        '# Kit gaps',
        '## GAP-001 — Per-record upload grants',
        'Package: @adula/kit 1.0.0',
        'Needed by: server code cannot let one user upload to one record.',
        'Tried: role rules and a module page.',
        'Blocked because: POST /attachments checks resource-wide rules only.',
        'Proposed kit change: attachments.grant({ resource, id, field, actor, ttl }).',
        'Reproduction: create-app, add a resource with an attachment field,',
        'give a role no update right, then upload from a module page.',
        'Acceptance: a PostgreSQL test that uploads with a grant and is refused without one.',
        'Workaround: none; see https://clinic.example/page and owner@clinic.example',
        'Issue:',
        '## GAP-002 — Printing',
        'Needed by: printed record sheets.',
        'Issue: #12',
      ].join('\n'),
      'https://github.com/example/kit/issues'
    )
    assert.lengthOf(gaps, 2)
    const url = new URL(gaps[0].url!)
    assert.equal(url.origin + url.pathname, 'https://github.com/example/kit/issues/new')
    assert.equal(url.searchParams.get('template'), 'gap.yml')
    assert.equal(url.searchParams.get('title'), 'Per-record upload grants')
    assert.equal(url.searchParams.get('package'), '@adula/kit 1.0.0')
    assert.equal(
      url.searchParams.get('reproduction'),
      'create-app, add a resource with an attachment field,\ngive a role no update right, then upload from a module page.'
    )
    assert.equal(url.searchParams.get('workaround'), 'none; see <url> and <email>')
    assert.deepEqual(gaps[0].missing, [])
    assert.equal(gaps[1].issue, '#12')
    assert.isUndefined(gaps[1].url)
    assert.includeMembers(gaps[1].missing, ['Package', 'Reproduction', 'Acceptance'])
  })

  test('the installed template is a comment, not a gap', ({ assert }) => {
    const { gaps, titles } = gapReport(GAPS_TEMPLATE)
    assert.lengthOf(gaps, 0)
    assert.lengthOf(titles, 0)
  })

  test('the gap form asks for every KIT_GAPS.md field', async ({ assert }) => {
    const form = await readFile(
      new URL('../../../.github/ISSUE_TEMPLATE/gap.yml', import.meta.url),
      'utf8'
    )
    for (const field of GAP_FIELDS) assert.include(form, `id: ${field.id}\n`)
  })

  test('adula:gaps is registered with the kit commands', async ({ assert }) => {
    const commands = await getMetaData()
    const names = commands.map((command) => command.commandName)
    assert.include(names, 'adula:gaps')
  })
})
