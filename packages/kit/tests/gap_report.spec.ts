import { test } from '@japa/runner'
import { gapReport } from '../src/commands/gap_report.js'
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

  test('adula:gaps is registered with the kit commands', async ({ assert }) => {
    const commands = await getMetaData()
    const names = commands.map((command) => command.commandName)
    assert.include(names, 'adula:gaps')
  })
})
