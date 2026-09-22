import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { generateResource } from '../src/commands/generator.js'
import { fileURLToPath } from 'node:url'
export default class Resource extends BaseCommand {
  static commandName = 'adula:resource'
  static description =
    'Generate a scoped resource, migration, model, validator, factory and security contract'
  @args.string() declare name: string
  @flags.string() declare module: string
  async run() {
    if (!this.module) {
      this.logger.error('--module is required')
      this.exitCode = 1
      return
    }
    const files = await generateResource(fileURLToPath(this.app.appRoot), this.name, this.module)
    files.forEach((file) => this.logger.success(file))
    this.logger.info(
      'Set bilingual labels, fill the resource definition, migrate, and run the generated security contract.'
    )
  }
}
