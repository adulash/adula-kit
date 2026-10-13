import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { readFile } from 'node:fs/promises'
import { gapReport } from '../src/commands/gap_report.js'
import { LEGACY_FILES } from '../src/upgrade/legacy.js'

/** Collects GAPS.md for reporting; nothing leaves the machine without explicit confirmation. */
export default class Gaps extends BaseCommand {
  static commandName = 'adula:gaps'
  static description =
    'Show the project gap report with private names masked, and links that open the AdulaJS gap form prefilled'
  static options = { startApp: false }
  @args.string({ description: 'report' }) declare action: string
  @flags.boolean({ description: 'Print without asking for confirmation' }) declare yes: boolean

  async run() {
    if (this.action !== 'report') throw new Error('Usage: adula:gaps report [--yes]')
    const path = this.app.makePath('GAPS.md')
    let content: string
    try {
      content = await readFile(path, 'utf8')
    } catch {
      // Until adula:upgrade renames it, a 1.x application keeps its gap log under the old name.
      const [legacy] = LEGACY_FILES.gaps
      try {
        content = await readFile(this.app.makePath(legacy), 'utf8')
      } catch {
        throw new Error('GAPS.md does not exist; adula:install creates it')
      }
      this.logger.warning(`Reading ${legacy}; run adula:upgrade to rename it to GAPS.md`)
    }
    const { masked, gaps } = gapReport(content)
    this.logger.info(`${gaps.length} gap(s) recorded in GAPS.md`)
    for (const gap of gaps)
      this.logger.log(`  ${gap.title}${gap.issue ? ` (reported: ${gap.issue})` : ''}`)
    if (!this.yes) {
      const confirmed = await this.prompt.confirm(
        'Show the full masked report and the issue links? Nothing is sent anywhere by this command.'
      )
      if (!confirmed) return
    }
    this.logger.log(masked)
    const pending = gaps.filter((gap) => gap.url)
    if (!pending.length) return
    this.logger.info(
      'Review each link in a browser, submit the form, then write the issue number in the entry as "Issue: #<number>".'
    )
    for (const gap of pending) {
      this.logger.log(`\n${gap.title}`)
      if (gap.missing.length)
        this.logger.warning(`Complete before submitting: ${gap.missing.join(', ')}`)
      this.logger.log(gap.url!)
    }
  }
}
