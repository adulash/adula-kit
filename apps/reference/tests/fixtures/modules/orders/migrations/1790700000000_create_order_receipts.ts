import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'order_receipts',
      scoped: true,
      fields: {
        reference: {
          type: 'string',
          required: true,
          searchable: true,
          label: { ar: 'رقم الإيصال', en: 'Reference' },
        },
        scan: {
          type: 'attachment',
          accept: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
          label: { ar: 'صورة الإيصال', en: 'Scan' },
        },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
