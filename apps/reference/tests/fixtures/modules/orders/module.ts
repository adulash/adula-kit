import orders from './resources/orders.js'
import order_lines from './resources/order_lines.js'
import order_receipts from './resources/order_receipts.js'
import order_deliveries from './resources/order_deliveries.js'
import orderApproval from './workflows/order_approval.js'
// adula:imports
export default {
  name: 'orders',
  reference: true,
  label: { ar: 'الطلبات', en: 'Orders' },
  dependsOn: ['customers'],
  resources: [orders, order_lines, order_receipts, order_deliveries /* adula:resources */],
  workflows: [orderApproval],
}
