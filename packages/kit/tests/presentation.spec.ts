import { test } from '@japa/runner'
import { BaseModel } from '@adonisjs/lucid/orm'
import { ResourceRegistry, ResourceService, defineResource } from '../index.js'
import type { RecordData } from '../index.js'
import { admin, customer, db, line, order, reader, registry, setup } from './helpers.js'

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

  test('record titles use the sequence and title fields the actor may read', async ({ assert }) => {
    const service = new ResourceService(db, registry)
    const visible = await service.save('orders', admin, { notes: 'أجهزة', orgUnitId: 2 })
    const elsewhere = await service.save('orders', admin, { notes: 'أثاث', orgUnitId: 3 })
    // Default: the sequence field, then the first list field (here both are the number).
    const titles = await service.recordTitles(
      'orders',
      [Number(visible.id), Number(elsewhere.id)],
      reader
    )
    assert.equal(titles.get(Number(visible.id)), visible.number)
    // A record outside the reader's organization scope never reveals its number.
    assert.equal(titles.get(Number(elsewhere.id)), `#${elsewhere.id}`)
    // Declared title fields, where a hidden field is dropped for readers below its level.
    const titled = new ResourceRegistry().register([
      { name: 'customers', label: customer.label, dependsOn: [], resources: [customer] },
      {
        name: 'orders',
        label: order.label,
        dependsOn: ['customers'],
        resources: [{ ...order, title: ['number', 'notes', 'internalNote'] }, line],
      },
    ])
    await db('orders').where('id', Number(visible.id)).update({ internal_note: 'سري' })
    const named = new ResourceService(db, titled)
    assert.equal(
      await named.recordTitle('orders', Number(visible.id), reader),
      `${visible.number} · أجهزة`
    )
    assert.equal(
      await named.recordTitle('orders', Number(visible.id), admin),
      `${visible.number} · أجهزة · سري`
    )
    assert.equal(await named.recordTitle('removed_resource', 5, admin), '#5')
    assert.throws(
      () =>
        defineResource({
          ...order,
          name: 'bad_titles',
          title: ['lines'],
        }),
      /title field lines/
    )
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
