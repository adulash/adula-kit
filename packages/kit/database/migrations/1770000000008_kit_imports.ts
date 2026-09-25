import { BaseSchema } from '@adonisjs/lucid/schema'
import { createImportsSchema } from '../../src/database/schema.js'

export default class KitImports extends BaseSchema {
  async up() {
    await createImportsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
