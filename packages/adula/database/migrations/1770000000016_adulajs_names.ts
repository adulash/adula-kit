import { BaseSchema } from '@adonisjs/lucid/schema'
import { renameLegacyDatabaseObjects } from '../../src/upgrade/rename.js'

/** 2.0.0: database objects, the version setting and listener names created by 1.x get their AdulaJS names. */
export default class AdulaJsNames extends BaseSchema {
  async up() {
    await renameLegacyDatabaseObjects(this.db.getWriteClient())
  }
  async down() {
    throw new Error(
      'AdulaJS migrations are additive. Restore a tested backup instead of rolling back.'
    )
  }
}
