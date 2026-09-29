import { defineResource } from '@adula/kit'
import Model from '#tests/fixtures/modules/orders/models/order_inspections'
import { validator } from '#tests/fixtures/modules/orders/validators/order_inspections'

// A supervisory inspection assigned to a user of the order's unit (#28). A role rule such
// as { inspector: '$actor.id' } lets each inspector update only their own inspections (#29).
export default defineResource({
  ...{
    name: 'order_inspections',
    label: {
      ar: 'تفتيش الطلبات',
      en: 'Order inspections',
    },
    scoped: true,
    fields: {
      inspector: {
        type: 'user',
        required: true,
        filterable: true,
        sortable: true,
        label: {
          ar: 'المفتش',
          en: 'Inspector',
        },
      },
      findings: {
        type: 'text',
        label: {
          ar: 'الملاحظات',
          en: 'Findings',
        },
      },
    },
    list: ['inspector', 'findings'],
    form: ['inspector', 'findings'],
    show: ['inspector', 'findings'],
    actions: ['view', 'create', 'update', 'delete'],
  },
  model: Model,
  validator,
})
