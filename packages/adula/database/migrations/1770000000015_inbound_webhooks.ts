import { BaseSchema } from '@adonisjs/lucid/schema'
import { createInboundWebhooksSchema } from '../../src/database/schema.js'

export default class InboundWebhooks extends BaseSchema {
  async up() {
    await createInboundWebhooksSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error(
      'AdulaJS migrations are additive. Restore a tested backup instead of rolling back.'
    )
  }
}
