import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'order_inspections',
      scoped: true,
      fields: {
        inspector: {
          type: 'user',
          required: true,
          filterable: true,
          sortable: true,
          label: { ar: 'المفتش', en: 'Inspector' },
        },
        findings: { type: 'text', label: { ar: 'الملاحظات', en: 'Findings' } },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
