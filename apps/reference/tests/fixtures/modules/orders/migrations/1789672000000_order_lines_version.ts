import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('order_lines', (table) => {
      table.integer('version').notNullable().defaultTo(1)
    })
  }
  async down() {
    this.schema.alterTable('order_lines', (table) => table.dropColumn('version'))
  }
}
