import type { Module } from '@adula/kit'
import orders from './resources/orders.js'
import order_lines from './resources/order_lines.js'
import orderApproval from './workflows/order_approval.js'
// adula:imports
export default {
  name: 'orders',
  reference: true,
  label: { ar: 'الطلبات', en: 'Orders' },
  dependsOn: ['customers'],
  resources: [orders, order_lines /* adula:resources */],
  workflows: [orderApproval],
  lookups: {
    order_status: [
      { key: 'open', label: { ar: 'مفتوح', en: 'Open' } },
      { key: 'closed', label: { ar: 'مغلق', en: 'Closed' } },
      { key: 'approved', label: { ar: 'معتمد', en: 'Approved' } },
    ],
  },
  // Addressed by key from the approval workflow; administrators may rename them.
  defaultRoles: [
    {
      key: 'department_manager',
      name: 'مدير القسم',
      permissionLevel: 1,
      rules: [{ subject: 'orders', action: 'view' }],
    },
    {
      key: 'general_manager',
      name: 'المدير العام',
      permissionLevel: 1,
      rules: [{ subject: 'orders', action: 'view' }],
    },
  ],
} satisfies Module
