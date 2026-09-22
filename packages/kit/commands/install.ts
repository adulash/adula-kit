import { BaseCommand } from '@adonisjs/core/ace'
import { readFile, writeFile, access } from 'node:fs/promises'
import { Settings } from '../src/services/settings.js'
import { syncAgentAssets } from '../src/commands/agent_assets.js'
import { KIT_VERSION } from '../src/version.js'
import { fileURLToPath } from 'node:url'

export default class Install extends BaseCommand {
  static commandName = 'adula:install'
  static description =
    'Install core organization, administrator role and managed agent instructions after migrations'
  static options = { startApp: true }
  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const knex = db.connection().getWriteClient()
    const email = process.env.ADULA_ADMIN_EMAIL
    if (!email)
      throw new Error(
        'Set ADULA_ADMIN_EMAIL to an existing user email. Create the user through the official auth flow first.'
      )
    const user = await knex('users').where({ email }).first('id')
    if (!user)
      throw new Error(
        'Administrator user does not exist. Create it using the official signup flow first.'
      )
    await knex.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(717011)')
      let root = await trx('org_units').whereNull('parent_id').first()
      if (!root) {
        const [created] = await trx('org_units')
          .insert({ name: 'الجهة', type: 'root', path: 'root' })
          .returning('*')
        await trx('org_units')
          .where('id', created.id)
          .update({ path: String(created.id) })
        root = created
      }
      let role = await trx('roles').where('name', 'administrator').first()
      if (!role) {
        const [created] = await trx('roles')
          .insert({ name: 'administrator', permission_level: 1 })
          .returning('*')
        role = created
      }
      // Repair a missing bootstrap grant even when the role already exists.
      // The transaction lock makes repeated/concurrent installation idempotent.
      if (
        !(await trx('role_rules')
          .where({ role_id: role.id, subject: 'all', action: 'manage', inverted: false })
          .whereNull('conditions')
          .whereNull('fields')
          .first())
      )
        await trx('role_rules').insert({ role_id: role.id, subject: 'all', action: 'manage' })
      if (
        !(await trx('user_roles')
          .where({ user_id: user.id, role_id: role.id })
          .whereNull('org_unit_id')
          .first())
      )
        await trx('user_roles').insert({ user_id: user.id, role_id: role.id })
      await trx('user_org_units')
        .insert({ user_id: user.id, org_unit_id: root.id })
        .onConflict(['user_id', 'org_unit_id'])
        .ignore()
      await new Settings(trx).set('kit.version', KIT_VERSION)
    })
    for (const [name, content] of [
      ['CLAUDE.md', 'Read and follow AGENTS.md.\nThe project rules are maintained there.\n'],
      [
        'KIT_GAPS.md',
        '# Kit gaps\n\nRecord Needed by, Tried, Blocked because, Proposed kit change, Workaround.\n',
      ],
    ]) {
      const path = this.app.makePath(name)
      try {
        await access(path)
      } catch {
        await writeFile(path, content, { flag: 'wx' })
      }
    }
    await syncAgentAssets(fileURLToPath(this.app.appRoot))
    const pkg = JSON.parse(await readFile(this.app.makePath('package.json'), 'utf8'))
    let uiInstalled = false
    try {
      await access(this.app.makePath('ui.lock.json'))
      uiInstalled = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (pkg.dependencies?.['@adula/ui'] && !uiInstalled) {
      const ui = await this.kernel.exec('adula:ui', ['add', 'all'])
      if (ui.exitCode)
        throw new Error('UI installation failed; existing project customizations require review')
    }
    this.logger.success('Core installation complete. Run adula:doctor.')
  }
}
