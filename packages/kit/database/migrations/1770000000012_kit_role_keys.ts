import { BaseSchema } from '@adonisjs/lucid/schema'
import { createRoleKeysSchema } from '../../src/database/schema.js'

export default class KitRoleKeys extends BaseSchema {
  async up() {
    await createRoleKeysSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
