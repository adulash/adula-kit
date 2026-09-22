import { defineResource } from '@adula/kit'
import Model from '#tests/fixtures/modules/customers/models/customers'
import { validator } from '#tests/fixtures/modules/customers/validators/customers'

export default defineResource({
  ...{
    name: 'customers',
    label: {
      ar: 'العملاء',
      en: 'Customers',
    },
    scoped: false,
    fields: {
      name: {
        type: 'string',
        label: {
          ar: 'اسم العميل',
          en: 'Name',
        },
        required: true,
        unique: true,
        searchable: true,
      },
      email: {
        type: 'string',
        label: {
          ar: 'البريد الإلكتروني',
          en: 'Email',
        },
      },
    },
    list: ['name', 'email'],
    form: ['name', 'email'],
    show: ['name', 'email'],
    actions: ['view', 'create', 'update', 'delete'],
  },
  model: Model,
  validator,
})
