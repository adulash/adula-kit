import { test } from '@japa/runner'
import { BaseModel } from '@adonisjs/lucid/orm'
import { ResourceService, defineResource } from '../index.js'
import type { RecordData } from '../index.js'
import { admin, db, reader, registry, setup } from './helpers.js'

test.group('Resource presentation labels', (group) => {
  group.setup(async () => {
    await setup()
    // Host applications own users; the reference migration adds this column.
    await db.raw('ALTER TABLE users ADD COLUMN full_name varchar')
  })

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

  test('record() and details() serve a record view from one authorized read', async ({
    assert,
  }) => {
    const service = new ResourceService(db, registry)
    const saved = await service.save('orders', admin, {
      notes: 'عرض كامل',
      orgUnitId: 2,
    })
    const id = Number(saved.id)
    const view = await service.record('orders', id, reader)
    const show = await service.show('orders', id, reader)
    assert.deepEqual(view.data, show.data)
    assert.deepEqual(view.permissions, show.permissions)
    assert.deepEqual(view.children, await service.children('orders', id, reader))
    assert.deepEqual(view.activity, await service.activity('orders', id, reader))
    const details = await service.details('orders', id, reader)
    assert.deepEqual(details, { children: view.children, activity: view.activity })
    const outsider = { ...reader, orgPaths: ['1.3'] }
    await assert.rejects(() => service.record('orders', id, outsider), /السجل غير موجود/)
    await assert.rejects(() => service.details('orders', id, outsider), /السجل غير موجود/)
  })
})
