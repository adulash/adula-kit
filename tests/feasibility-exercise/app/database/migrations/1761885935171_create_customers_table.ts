import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('unit_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('units')
        .onDelete('RESTRICT')
      table.string('name', 200).notNullable()
      table.string('email', 254).nullable()
      table.string('phone', 40).nullable()
      table.string('address', 500).nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.integer('deleted_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()
      table.index(['unit_id'])
    })

    /**
     * Name is unique among active (not soft-deleted) customers, case-insensitive.
     * Enforced by the database as the final guard; the validator gives the
     * friendly message.
     */
    this.schema.raw(
      `CREATE UNIQUE INDEX customers_name_active_unique ON customers (lower(name)) WHERE deleted_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
