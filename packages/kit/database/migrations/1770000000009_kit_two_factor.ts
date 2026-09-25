import { BaseSchema } from '@adonisjs/lucid/schema'
import { createTwoFactorSchema } from '../../src/database/schema.js'

export default class KitTwoFactor extends BaseSchema {
  async up() {
    await createTwoFactorSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
