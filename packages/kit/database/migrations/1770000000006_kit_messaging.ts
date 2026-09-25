import { BaseSchema } from '@adonisjs/lucid/schema'
import { createMessagingSchema } from '../../src/database/schema.js'

export default class KitMessaging extends BaseSchema {
  async up() {
    await createMessagingSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
