import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per browser session of a signed-in user. The id is the session
 * store id, so revoking a row can also delete its "sessions" row at once.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('user_sessions', (table) => {
      table.string('id', 255).primary()
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('ip', 64).nullable()
      table.string('user_agent', 512).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('last_seen_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.index(['user_id'])
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration')
  }
}
