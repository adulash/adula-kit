import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('sessions', (table) => {
      table.string('id').primary()
      table.text('data').notNullable()
      table.timestamp('expires_at').notNullable().index()
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration')
  }
}
