import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('unit_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('units')
        .onDelete('RESTRICT')
      table.string('role', 20).notNullable().defaultTo('employee')
    })
    this.schema.raw(
      `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'manager'))`
    )
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
      table.dropColumn('unit_id')
    })
  }
}
