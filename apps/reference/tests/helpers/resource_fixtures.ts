import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import attachmentManager from '@jrmc/adonis-attachment/services/main'
import env from '#start/env'
import { attachmentUrl, registerUpload } from '@adula/kit'
import { kit } from '#services/kit'
import type { FixtureContext, ResourceFixture } from '#tests/helpers/resource_contract'

/** A real Drive write plus the kit metadata row, exactly what POST /attachments does. */
async function uploadContract(userId: number, unique: string) {
  const directory = await mkdtemp(join(tmpdir(), 'adula-fixture-'))
  const source = join(directory, 'contract.pdf')
  await writeFile(source, `%PDF-1.4\n% عقد ${unique}\n`)
  try {
    const disk = env.get('DRIVE_DISK')
    const attachment = await attachmentManager.createFromPath(source, 'عقد.pdf')
    attachment.name = `${randomUUID()}.pdf`
    attachment.setOptions({ folder: 'resources/orders/contract', disk })
    await attachmentManager.write(attachment)
    const path = (attachment.path ?? '').replaceAll('\\', '/')
    const row = await registerUpload(db.connection().getWriteClient(), {
      disk,
      path,
      name: attachment.name,
      originalName: 'عقد.pdf',
      size: attachment.size,
      mimeType: 'application/pdf',
      extname: 'pdf',
      data: { ...attachment.toObject(), path },
      uploadedBy: userId,
      resource: 'orders',
      field: 'contract',
    })
    return {
      id: row.id,
      summary: {
        id: row.id,
        name: 'عقد.pdf',
        size: row.size,
        mimeType: 'application/pdf',
        url: attachmentUrl(row.id),
      },
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function parentOrder({ userId, orgUnitId, unique }: FixtureContext) {
  const runtime = kit()
  const actor = await runtime.actors.load(userId)
  return runtime.resources.save('orders', actor, { orgUnitId, notes: `طلب مرتبط ${unique}` })
}

export const resourceFixtures: Record<string, ResourceFixture> = {
  customers: ({ unique }) => ({
    input: { name: `عميل ${unique}`, email: 'customer@example.test' },
    expected: { name: `عميل ${unique}`, email: 'customer@example.test' },
    update: { name: `عميل محدث ${unique}`, email: 'updated@example.test' },
    updated: { name: `عميل محدث ${unique}`, email: 'updated@example.test' },
  }),
  orders: async ({ userId, unique }) => {
    const runtime = kit()
    const actor = await runtime.actors.load(userId)
    const customer = await runtime.resources.save('customers', actor, {
      name: `عميل الطلب ${unique}`,
    })
    await db
      .connection()
      .getWriteClient()('lookups')
      .insert({
        group: 'order_status',
        key: 'contract_open',
        label_ar: 'مفتوح للاختبار',
        label_en: 'Contract open',
      })
      .onConflict(['group', 'key'])
      .ignore()
    const values = {
      customerId: customer.id,
      total: '9007199254740993',
      status: 'contract_open',
      notes: `طلب ${unique}`,
      issuedAt: '2026-09-18',
      internalNote: `ملاحظة خاصة ${unique}`,
    }
    const contract = await uploadContract(userId, unique)
    const replacement = await uploadContract(userId, `${unique}-replacement`)
    return {
      input: {
        ...values,
        contract: contract.id,
        lines: [{ description: 'بند اختباري', quantity: 2 }],
      },
      expected: { ...values, contract: contract.summary },
      stored: { contract: contract.id },
      inline: { lines: [{ description: 'بند اختباري', quantity: 2 }] },
      update: { ...values, notes: `طلب محدث ${unique}`, contract: replacement.id, lines: [] },
      updated: { ...values, notes: `طلب محدث ${unique}`, contract: replacement.summary },
      updatedStored: { contract: replacement.id },
      updatedInline: { lines: [{ description: 'بند اختباري', quantity: 2 }] },
    }
  },
  order_lines: async (context) => {
    const order = await parentOrder(context)
    const values = { orderId: order.id, description: `بند ${context.unique}`, quantity: 2 }
    return {
      input: values,
      expected: values,
      update: { ...values, quantity: 3 },
      updated: { ...values, quantity: 3 },
    }
  },
  tasks: async (context) => {
    const order = await parentOrder(context)
    const values = { title: `مهمة ${context.unique}`, orderId: order.id, done: false }
    return {
      input: values,
      expected: values,
      update: { ...values, done: true },
      updated: { ...values, done: true },
    }
  },
}
