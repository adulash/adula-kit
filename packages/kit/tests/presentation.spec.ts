import { test } from '@japa/runner'
import { BaseModel } from '@adonisjs/lucid/orm'
import { ResourceService, defineResource } from '../index.js'
import type { RecordData } from '../index.js'
import { admin, db, registry, setup } from './helpers.js'

test.group('Resource presentation labels', (group) => {
  group.setup(setup)

  test('record and create labels are optional, bilingual and exposed to pages', async ({
    assert,
  }) => {
    const base = {
      name: 'accounts',
      label: { ar: 'الحسابات', en: 'Accounts' },
      model: BaseModel,
      scoped: false,
      fields: { name: { type: 'string', label: { ar: 'الاسم', en: 'Name' } } },
      list: ['name'],
      form: ['name'],
      show: ['name'],
      actions: ['view', 'create'],
      validator: { validate: async (data: unknown) => data as RecordData },
    } as const
    const account = defineResource({ ...base, recordLabel: { ar: 'حساب', en: 'Account' } })
    assert.equal(account.recordLabel?.ar, 'حساب')
    assert.throws(
      () => defineResource({ ...base, recordLabel: { ar: 'حساب', en: '' } }),
      /recordLabel and createLabel/
    )
    // Resources without the labels keep the generic wording (null here, «سجل» in the UI).
    const service = new ResourceService(db, registry)
    const described = service.describe('customers', admin)
    assert.isNull(described.recordLabel)
    assert.isNull(described.createLabel)
    const editor = await service.editor('customers', admin)
    assert.isNull(editor.recordLabel)
  })
})
