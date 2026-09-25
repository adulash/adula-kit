import { defineWorkflow } from '@adula/kit'

/**
 * Two-level approval: orders from 10,000.00 need the department manager and then
 * the general manager; smaller orders are approved directly. Rejection cancels.
 */
export default defineWorkflow({
  name: 'order_approval',
  version: 1,
  resource: 'orders',
  label: 'اعتماد الطلبات',
  start: 'size',
  steps: {
    size: {
      type: 'condition',
      label: 'فحص قيمة الطلب',
      when: (order) => BigInt(String(order.total ?? '0')) >= 1000000n,
      then: 'manager',
      else: 'approved',
    },
    manager: {
      type: 'approval',
      label: 'موافقة مدير القسم',
      assignees: { role: 'مدير القسم' },
      dueInDays: 2,
      approve: 'director',
      reject: 'rejected',
    },
    director: {
      type: 'approval',
      label: 'موافقة المدير العام',
      assignees: { role: 'المدير العام' },
      dueInDays: 2,
      approve: 'mark',
      reject: 'rejected',
    },
    mark: {
      type: 'update',
      label: 'تعليم الطلب كمعتمد',
      values: { status: 'approved' },
      next: 'tell',
    },
    tell: { type: 'notify', label: 'إبلاغ مقدم الطلب', to: 'submitter', next: 'approved' },
    approved: { type: 'end', label: 'معتمد', outcome: 'approved' },
    rejected: { type: 'end', label: 'مرفوض', outcome: 'rejected', cancelDocument: true },
  },
})
