import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'

/** Immutable initial schema snapshot of ticket replies (inline lines of a ticket). */
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'ticket_replies',
      scoped: true,
      version: true,
      fields: {
        ticketId: {
          type: 'belongsTo',
          resource: 'tickets',
          required: true,
          label: { ar: 'التذكرة', en: 'Ticket' },
        },
        body: { type: 'text', required: true, label: { ar: 'نص الرد', en: 'Body' } },
      },
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
