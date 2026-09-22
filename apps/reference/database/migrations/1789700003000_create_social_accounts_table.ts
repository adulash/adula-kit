import { BaseSchema } from '@adonisjs/lucid/schema'

/** Links an OAuth identity (provider + provider id) to exactly one local user. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('social_accounts', (table) => {
      table.increments('id')
      table.string('provider', 32).notNullable()
      table.string('provider_id', 255).notNullable()
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['provider', 'provider_id'])
      table.index(['user_id'])
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration')
  }
}
