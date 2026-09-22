import { BaseSchema } from '@adonisjs/lucid/schema'

// Additive: the contract column references the kit attachments table created before module migrations.
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('orders', (table) => {
      table.integer('contract').references('id').inTable('attachments').onDelete('RESTRICT').index()
    })
  }
  async down() {
    this.schema.alterTable('orders', (table) => table.dropColumn('contract'))
  }
}
