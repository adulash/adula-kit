import { BaseCommand, flags } from '@adonisjs/core/ace'
import { writeFile } from 'node:fs/promises'
import type { ResourceRegistry } from '../src/resource/registry.js'
import { capabilityCatalog } from '../src/commands/capabilities.js'

export default class Capabilities extends BaseCommand {
  static commandName = 'adula:capabilities'
  static description = 'Generate the capability catalog (kit features plus this project registry)'
  static options = { startApp: true }
  @flags.boolean({ description: 'Write capabilities.md at the project root' })
  declare write: boolean
  async run() {
    let registry: ResourceRegistry | undefined
    try {
      ;({ registry } = await this.app.import('#start/modules'))
    } catch {
      this.logger.warning('start/modules could not be loaded; printing kit capabilities only')
    }
    // Imported lazily: main.ts lists this command itself.
    const { getMetaData } = await import('./main.js')
    const metadata = await getMetaData()
    const catalog = capabilityCatalog({
      registry,
      commands: metadata.map((command) => `${command.commandName} — ${command.description}`),
    })
    if (this.write) {
      await writeFile(this.app.makePath('capabilities.md'), catalog)
      this.logger.success('capabilities.md')
    } else this.logger.log(catalog)
  }
}
