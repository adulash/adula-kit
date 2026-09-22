import orders from './resources/orders.js'
import order_lines from './resources/order_lines.js'
// adula:imports
export default {
  name: 'orders',
  reference: true,
  label: { ar: 'الطلبات', en: 'Orders' },
  dependsOn: ['customers'],
  resources: [orders, order_lines /* adula:resources */],
}
