import { BaseSchema } from '@adonisjs/lucid/schema'
import { createImportsSchema } from '../../src/database/schema.js'

export default class Imports extends BaseSchema {
  async up() {
    await createImportsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error(
      'AdulaJS migrations are additive. Restore a tested backup instead of rolling back.'
    )
  }
}
