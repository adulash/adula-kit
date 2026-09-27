import { BaseSchema } from '@adonisjs/lucid/schema'
import { createNotificationTargetsSchema } from '../../src/database/schema.js'

export default class KitNotificationTargets extends BaseSchema {
  async up() {
    await createNotificationTargetsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
