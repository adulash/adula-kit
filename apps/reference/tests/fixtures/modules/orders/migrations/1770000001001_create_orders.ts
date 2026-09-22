import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'orders',
      scoped: true,
      submittable: true,
      version: true,
      fields: {
        number: {
          type: 'string',
          label: {
            ar: 'رقم الطلب',
            en: 'Number',
          },
          sequence: 'ORD',
          unique: true,
        },
        customerId: {
          type: 'belongsTo',
          resource: 'customers',
          label: {
            ar: 'العميل',
            en: 'Customer',
          },
        },
        total: {
          type: 'money',
          label: {
            ar: 'الإجمالي',
            en: 'Total',
          },
          permissionLevel: 1,
          sortable: true,
        },
        status: {
          type: 'lookup',
          group: 'order_status',
          label: {
            ar: 'الحالة',
            en: 'Status',
          },
          filterable: true,
        },
        notes: {
          type: 'text',
          label: {
            ar: 'ملاحظات',
            en: 'Notes',
          },
          searchable: true,
        },
        issuedAt: {
          type: 'date',
          label: {
            ar: 'تاريخ الإصدار',
            en: 'Issued at',
          },
          sortable: true,
        },
        internalNote: {
          type: 'text',
          label: {
            ar: 'ملاحظة داخلية',
            en: 'Internal note',
          },
        },
        lines: {
          type: 'hasMany',
          resource: 'order_lines',
          foreignKey: 'orderId',
          inline: true,
          label: {
            ar: 'البنود',
            en: 'Lines',
          },
        },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
