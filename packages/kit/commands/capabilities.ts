import { BaseCommand } from '@adonisjs/core/ace'
import { readFile } from 'node:fs/promises'
export default class Capabilities extends BaseCommand {
  static commandName = 'adula:capabilities'
  static description = 'Print implemented capabilities and current acceptance boundary'
  async run() {
    this.logger.log(await readFile(new URL('../agent/capabilities.md', import.meta.url), 'utf8'))
  }
}
