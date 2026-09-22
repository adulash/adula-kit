import { defineResource } from '@adula/kit'
import Model from '#tests/fixtures/modules/orders/models/order_lines'
import { validator } from '#tests/fixtures/modules/orders/validators/order_lines'

export default defineResource({
  ...{
    name: 'order_lines',
    label: {
      ar: 'بنود الطلب',
      en: 'Order lines',
    },
    scoped: true,
    version: true,
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
      description: {
        type: 'string',
        required: true,
        label: {
          ar: 'الوصف',
          en: 'Description',
        },
      },
      quantity: {
        type: 'integer',
        required: true,
        label: {
          ar: 'الكمية',
          en: 'Quantity',
        },
      },
    },
    list: ['orderId', 'description', 'quantity'],
    form: ['orderId', 'description', 'quantity'],
    show: ['orderId', 'description', 'quantity'],
    actions: ['view', 'create', 'update', 'delete'],
  },
  model: Model,
  validator,
})
