import { BaseSchema } from '@adonisjs/lucid/schema'
import { createRoleKeysSchema } from '../../src/database/schema.js'

export default class RoleKeys extends BaseSchema {
  async up() {
    await createRoleKeysSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error(
      'AdulaJS migrations are additive. Restore a tested backup instead of rolling back.'
    )
  }
}
