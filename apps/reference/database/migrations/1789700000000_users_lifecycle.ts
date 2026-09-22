import { BaseSchema } from '@adonisjs/lucid/schema'

/** Additive: a disabled user keeps their rows; only sign-in and sessions stop. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.timestamp('disabled_at', { useTz: true }).nullable()
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration')
  }
}
