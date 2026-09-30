import { BaseSchema } from '@adonisjs/lucid/schema'
import { createUploadGrantsSchema } from '../../src/database/schema.js'

export default class KitUploadGrants extends BaseSchema {
  async up() {
    await createUploadGrantsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
