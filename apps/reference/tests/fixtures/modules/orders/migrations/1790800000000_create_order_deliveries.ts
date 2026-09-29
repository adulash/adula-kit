import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'order_deliveries',
      scoped: true,
      fields: {
        orderId: {
          type: 'belongsTo',
          resource: 'orders',
          required: true,
          label: { ar: 'الطلب', en: 'Order' },
        },
        recipient: {
          type: 'string',
          required: true,
          searchable: true,
          label: { ar: 'المستلم', en: 'Recipient' },
        },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
