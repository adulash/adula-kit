import { BaseSchema } from '@adonisjs/lucid/schema'
import { createWebhooksSchema } from '../../src/database/schema.js'

export default class Webhooks extends BaseSchema {
  async up() {
    await createWebhooksSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error(
      'AdulaJS migrations are additive. Restore a tested backup instead of rolling back.'
    )
  }
}
