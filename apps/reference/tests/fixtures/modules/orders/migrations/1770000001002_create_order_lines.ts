import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'order_lines',
      scoped: true,
      fields: {
        orderId: {
          type: 'belongsTo',
          resource: 'orders',
          required: true,
          label: {
            ar: 'الطلب',
            en: 'Order',
          },
        },
        description: {
          type: 'string',
          required: true,
          label: {
            ar: 'الوصف',
            en: 'Description',
          },
        },
        quantity: {
          type: 'integer',
          required: true,
          label: {
            ar: 'الكمية',
            en: 'Quantity',
          },
        },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
