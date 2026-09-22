import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { readFile } from 'node:fs/promises'

/** Collects KIT_GAPS.md for reporting; nothing leaves the machine without explicit confirmation. */
export default class Gaps extends BaseCommand {
  static commandName = 'adula:gaps'
  static description = 'Show the project gap report with private names masked before it is sent'
  static options = { startApp: false }
  @args.string({ description: 'report' }) declare action: string
  @flags.boolean({ description: 'Print without asking for confirmation' }) declare yes: boolean

  async run() {
    if (this.action !== 'report') throw new Error('Usage: adula:gaps report [--yes]')
    const path = this.app.makePath('KIT_GAPS.md')
    let content: string
    try {
      content = await readFile(path, 'utf8')
    } catch {
      throw new Error('KIT_GAPS.md does not exist; adula:install creates it')
    }
    const masked = content
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
      .replace(/https?:\/\/[^\s)]+/g, '<url>')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
    const gaps = masked.match(/^## GAP-\d+.*$/gm) ?? []
    this.logger.info(`${gaps.length} gap(s) recorded in KIT_GAPS.md`)
    for (const title of gaps) this.logger.log(`  ${title.replace(/^## /, '')}`)
    if (!this.yes) {
      const confirmed = await this.prompt.confirm(
        'Show the full masked report? Nothing is sent anywhere by this command.'
      )
      if (!confirmed) return
    }
    this.logger.log(masked)
  }
}
