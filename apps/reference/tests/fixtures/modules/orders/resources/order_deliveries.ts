import { defineResource } from '@adula/kit'
import Model from '#tests/fixtures/modules/orders/models/order_deliveries'
import { validator } from '#tests/fixtures/modules/orders/validators/order_deliveries'

// A delivery always lives in its order's organization unit: the unit is copied from the
// order before authorization, and the form shows no unit picker.
export default defineResource({
  ...{
    name: 'order_deliveries',
    label: {
      ar: 'تسليمات الطلبات',
      en: 'Order deliveries',
    },
    scoped: true,
    scope: { from: 'orderId' },
    fields: {
      orderId: {
        type: 'belongsTo',
        resource: 'orders',
        required: true,
        label: {
          ar: 'الطلب',
          en: 'Order',
        },
      },
      recipient: {
        type: 'string',
        required: true,
        searchable: true,
        label: {
          ar: 'المستلم',
          en: 'Recipient',
        },
      },
    },
    list: ['orderId', 'recipient'],
    form: ['orderId', 'recipient'],
    show: ['orderId', 'recipient'],
    actions: ['view', 'create', 'update', 'delete'],
  },
  model: Model,
  validator,
})
