import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'tasks',
      scoped: true,
      fields: {
        title: {
          type: 'string',
          required: true,
          searchable: true,
          label: {
            ar: 'المهمة',
            en: 'Title',
          },
        },
        orderId: {
          type: 'belongsTo',
          resource: 'orders',
          label: {
            ar: 'الطلب',
            en: 'Order',
          },
        },
        done: {
          type: 'boolean',
          label: {
            ar: 'مكتملة',
            en: 'Done',
          },
        },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
