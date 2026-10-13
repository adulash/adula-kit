import { BaseSchema } from '@adonisjs/lucid/schema'
import { createAssignmentsSchema } from '../../src/database/schema.js'

export default class Assignments extends BaseSchema {
  async up() {
    await createAssignmentsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error(
      'AdulaJS migrations are additive. Restore a tested backup instead of rolling back.'
    )
  }
}
