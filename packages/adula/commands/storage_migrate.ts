import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { migrateStorage } from '../src/attachments/storage_migrate.js'

export default class StorageMigrate extends BaseCommand {
  static commandName = 'adula:storage:migrate'
  static description = 'Copy attachment files from one Drive disk to another and repoint their rows'
  static options = { startApp: true }
  @args.string({ description: 'Source disk name' }) declare from: string
  @args.string({ description: 'Target disk name' }) declare to: string
  @flags.boolean({ description: 'List the files that would move without copying anything' })
  declare dryRun: boolean
  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { default: drive } = await import('@adonisjs/drive/services/main')
    const { configProvider } = await import('@adonisjs/core')
    const resolved = await configProvider.resolve<{
      config: { services: Record<string, unknown> }
    }>(this.app, this.app.config.get('drive'))
    const result = await migrateStorage(db.connection().getWriteClient(), {
      from: this.from,
      to: this.to,
      disks: Object.keys(resolved?.config.services ?? {}),
      dryRun: Boolean(this.dryRun),
      use: (name) => drive.use(name as never),
      report: (line) => this.logger.info(line),
    })
    this.logger.log(JSON.stringify(result))
    if (result.failed.length) this.exitCode = 1
  }
}
