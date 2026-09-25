import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'

/** Immutable initial schema snapshot of support tickets (expand/contract afterwards). */
export default class extends BaseSchema {
  async up() {
    const db = this.db.getWriteClient()
    await createResourceTable(db, {
      name: 'tickets',
      scoped: true,
      submittable: true,
      version: true,
      fields: {
        number: {
          type: 'string',
          label: { ar: 'رقم التذكرة', en: 'Number' },
          sequence: 'TKT',
          unique: true,
        },
        subject: {
          type: 'string',
          label: { ar: 'الموضوع', en: 'Subject' },
          required: true,
          searchable: true,
        },
        priority: {
          type: 'lookup',
          group: 'ticket_priority',
          label: { ar: 'الأولوية', en: 'Priority' },
          required: true,
        },
        description: { type: 'text', label: { ar: 'الوصف', en: 'Description' }, searchable: true },
        dueOn: { type: 'date', label: { ar: 'تاريخ الاستحقاق', en: 'Due on' } },
        escalated: { type: 'boolean', label: { ar: 'مصعّدة', en: 'Escalated' } },
      },
    })
    await db('lookups')
      .insert([
        { group: 'ticket_priority', key: 'low', label_ar: 'منخفضة', label_en: 'Low', sort: 1 },
        { group: 'ticket_priority', key: 'normal', label_ar: 'عادية', label_en: 'Normal', sort: 2 },
        { group: 'ticket_priority', key: 'high', label_ar: 'عالية', label_en: 'High', sort: 3 },
      ])
      .onConflict(['group', 'key'])
      .ignore()
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
