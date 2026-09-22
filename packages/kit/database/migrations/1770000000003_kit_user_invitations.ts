import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('user_invitations', (table) => {
      table.increments('id')
      table.string('email', 254).notNullable().unique()
      table.string('full_name', 120).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.integer('invited_by').unsigned().references('id').inTable('users').onDelete('RESTRICT')
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('accepted_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
