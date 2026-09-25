import { BaseSchema } from '@adonisjs/lucid/schema'
import { createCollaborationSchema } from '../../src/database/schema.js'

export default class KitCollaboration extends BaseSchema {
  async up() {
    await createCollaborationSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
