import { defineResource } from '@adula/kit'
import Model from '#modules/support/models/tickets'
import { validator } from '#modules/support/validators/tickets'

export default defineResource({
  name: 'tickets',
  label: { ar: 'تذاكر الدعم', en: 'Support tickets' },
  model: Model,
  scoped: true,
  submittable: true,
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
      sortable: true,
    },
    priority: {
      type: 'lookup',
      group: 'ticket_priority',
      label: { ar: 'الأولوية', en: 'Priority' },
      required: true,
      filterable: true,
    },
    description: {
      type: 'text',
      label: { ar: 'الوصف', en: 'Description' },
      searchable: true,
    },
    dueOn: { type: 'date', label: { ar: 'تاريخ الاستحقاق', en: 'Due on' }, sortable: true },
    escalated: { type: 'boolean', label: { ar: 'مصعّدة', en: 'Escalated' }, filterable: true },
    replies: {
      type: 'hasMany',
      resource: 'ticket_replies',
      foreignKey: 'ticketId',
      inline: true,
      label: { ar: 'الردود', en: 'Replies' },
    },
  },
  list: ['number', 'subject', 'priority', 'dueOn', 'escalated'],
  form: ['subject', 'priority', 'description', 'dueOn', 'replies'],
  show: ['number', 'subject', 'priority', 'description', 'dueOn', 'escalated', 'replies'],
  actions: ['view', 'create', 'update', 'delete', 'submit', 'cancel', 'amend'],
  validator,
})
