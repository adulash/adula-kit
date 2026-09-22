import { BaseSchema } from '@adonisjs/lucid/schema'
import { createAttachmentsSchema } from '../../src/database/schema.js'

export default class KitAttachments extends BaseSchema {
  async up() {
    await createAttachmentsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
