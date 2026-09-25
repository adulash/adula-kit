import { defineWorkflow } from '@adula/kit'

/** High-priority tickets need the support supervisor's approval to be escalated. */
export default defineWorkflow({
  name: 'ticket_escalation',
  version: 1,
  resource: 'tickets',
  label: 'تصعيد التذاكر',
  start: 'triage',
  steps: {
    triage: {
      type: 'condition',
      label: 'فرز الأولوية',
      when: (ticket) => ticket.priority === 'high',
      then: 'supervisor',
      else: 'handled',
    },
    supervisor: {
      type: 'approval',
      label: 'موافقة مشرف الدعم',
      assignees: { role: 'مشرف الدعم' },
      dueInDays: 1,
      approve: 'escalate',
      reject: 'handled',
    },
    escalate: {
      type: 'update',
      label: 'تعليم التذكرة كمصعّدة',
      values: { escalated: true },
      next: 'tell',
    },
    tell: { type: 'notify', label: 'إبلاغ مقدم التذكرة', to: 'submitter', next: 'handled' },
    handled: { type: 'end', label: 'منتهية', outcome: 'completed' },
  },
})
