import { BaseSchema } from '@adonisjs/lucid/schema'
import { createManagedAssignmentsSchema } from '../../src/database/schema.js'

export default class KitManagedAssignments extends BaseSchema {
  async up() {
    await createManagedAssignmentsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
