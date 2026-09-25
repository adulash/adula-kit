import resource_tickets from './resources/tickets.js'
import resource_ticket_replies from './resources/ticket_replies.js'
import ticketEscalation from './workflows/ticket_escalation.js'
// adula:imports
export default {
  name: 'support',
  label: { ar: 'الدعم الفني', en: 'Support' },
  dependsOn: [],
  resources: [resource_tickets, resource_ticket_replies /* adula:resources */],
  workflows: [ticketEscalation],
}
