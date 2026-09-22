import { BaseSchema } from '@adonisjs/lucid/schema'
import { createSavedViewsSchema } from '../../src/database/schema.js'

export default class KitSavedViews extends BaseSchema {
  async up() {
    await createSavedViewsSchema(this.db.getWriteClient())
  }
  async down() {
    throw new Error('Kit migrations are additive. Restore a tested backup instead of rolling back.')
  }
}
