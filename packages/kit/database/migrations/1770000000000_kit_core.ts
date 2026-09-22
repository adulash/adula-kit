import { BaseSchema } from '@adonisjs/lucid/schema'
import { createCoreSchema } from '../../src/database/schema.js'

export default class KitCore extends BaseSchema {
  async up() {
    await createCoreSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
