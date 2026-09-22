import { BaseCommand } from '@adonisjs/core/ace'
import { fileURLToPath } from 'node:url'
import { diagnose } from '../src/commands/doctor.js'
import { diagnoseAttachments } from '../src/attachments/doctor.js'
import { Settings } from '../src/services/settings.js'
import { MigrationRunner } from '@adonisjs/lucid/migration'
export default class Doctor extends BaseCommand {
  static commandName = 'adula:doctor'
  static description = 'Check kit ownership, installation and backup readiness'
  static options = { startApp: true }
  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const findings = await diagnose(
      fileURLToPath(this.app.appRoot),
      new Settings(db.connection().getWriteClient()),
      this.app.inProduction,
      process.env
    )
    findings.push(await diagnoseAttachments(db.connection().getWriteClient()))
    const migrations = await new MigrationRunner(db, this.app, { direction: 'up' }).getList()
    const missing = migrations.filter((entry) => entry.status === 'corrupt')
    const pending = migrations.filter((entry) => entry.status === 'pending')
    findings.push({
      check: 'database.migrations',
      status: missing.length ? 'fail' : pending.length ? 'warn' : 'pass',
      message: missing.length
        ? `Applied migration files are missing: ${missing.map((entry) => entry.name).join(', ')}`
        : pending.length
          ? `${pending.length} pending migrations; run migration:run after the deployment backup`
          : 'Migration files and database history agree',
    })
    for (const finding of findings)
      this.logger.log(`${finding.status.toUpperCase()} ${finding.check}: ${finding.message}`)
    if (findings.some((finding) => finding.status === 'fail')) this.exitCode = 1
  }
}
