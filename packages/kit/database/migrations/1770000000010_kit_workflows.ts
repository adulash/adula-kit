import { BaseSchema } from '@adonisjs/lucid/schema'
import { createWorkflowSchema } from '../../src/database/schema.js'

export default class KitWorkflows extends BaseSchema {
  async up() {
    await createWorkflowSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
