import { defineResource } from '@adula/kit'
import Model from '#tests/fixtures/modules/tasks/models/tasks'
import { validator } from '#tests/fixtures/modules/tasks/validators/tasks'

export default defineResource({
  ...{
    name: 'tasks',
    label: {
      ar: 'المهام',
      en: 'Tasks',
    },
    scoped: true,
    fields: {
      title: {
        type: 'string',
        required: true,
        searchable: true,
        label: {
          ar: 'المهمة',
          en: 'Title',
        },
      },
      orderId: {
        type: 'belongsTo',
        resource: 'orders',
        label: {
          ar: 'الطلب',
          en: 'Order',
        },
      },
      done: {
        type: 'boolean',
        label: {
          ar: 'مكتملة',
          en: 'Done',
        },
      },
    },
    list: ['title', 'orderId', 'done'],
    form: ['title', 'orderId', 'done'],
    show: ['title', 'orderId', 'done'],
    actions: ['view', 'create', 'update', 'delete'],
  },
  model: Model,
  validator,
})
