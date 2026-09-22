import { BaseSchema } from '@adonisjs/lucid/schema'
import { createResourceTable } from '@adula/kit'
// Immutable initial schema snapshot. Later changes require a new migration.
export default class extends BaseSchema {
  async up() {
    await createResourceTable(this.db.getWriteClient(), {
      name: 'customers',
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
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration or restore a backup')
  }
}
