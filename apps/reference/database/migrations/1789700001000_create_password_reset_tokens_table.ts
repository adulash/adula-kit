import { BaseSchema } from '@adonisjs/lucid/schema'

/** Single-use, hashed recovery tokens; the raw token only ever travels inside the e-mail. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('password_reset_tokens', (table) => {
      table.increments('id')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['user_id'])
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration')
  }
}
