import { defineResource } from '@adula/kit'
import Model from '#modules/support/models/ticket_replies'
import { validator } from '#modules/support/validators/ticket_replies'

export default defineResource({
  name: 'ticket_replies',
  label: { ar: 'ردود التذاكر', en: 'Ticket replies' },
  model: Model,
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
  list: ['body'],
  form: ['ticketId', 'body'],
  show: ['body'],
  actions: ['view', 'create', 'update', 'delete'],
  validator,
})
