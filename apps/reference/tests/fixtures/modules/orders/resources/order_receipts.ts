import { defineResource } from '@adula/kit'
import Model from '#tests/fixtures/modules/orders/models/order_receipts'
import { validator } from '#tests/fixtures/modules/orders/validators/order_receipts'

// A narrow resource: records are logged once and never edited, and the scan accepts
// images and PDF only. The generated security contract must accept it as declared.
export default defineResource({
  ...{
    name: 'order_receipts',
    label: {
      ar: 'إيصالات الطلبات',
      en: 'Order receipts',
    },
    scoped: true,
    fields: {
      reference: {
        type: 'string',
        required: true,
        searchable: true,
        label: {
          ar: 'رقم الإيصال',
          en: 'Reference',
        },
      },
      scan: {
        type: 'attachment',
        accept: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        label: {
          ar: 'صورة الإيصال',
          en: 'Scan',
        },
      },
    },
    list: ['reference', 'scan'],
    form: ['reference', 'scan'],
    show: ['reference', 'scan'],
    actions: ['view', 'create'],
  },
  model: Model,
  validator,
})
