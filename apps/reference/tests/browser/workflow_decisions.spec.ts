import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { BaseModel } from '@adonisjs/lucid/orm'
import {
  consumeEvent,
  createResourceTable,
  defineResource,
  defineWorkflow,
  workflowListeners,
  type DomainEvent,
  type Module,
  type RecordData,
} from '@adula/kit'
import { kit } from '#services/kit'
import { modules, registry } from '#start/modules'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const knex = () => db.connection().getWriteClient()

// A change request that the approver approves, rejects with a reason, or reassigns to
// another customer and date (#42).
const requests = defineResource({
  name: 'ui_requests',
  label: { ar: 'طلبات التغيير', en: 'Change requests' },
  model: BaseModel,
  scoped: true,
  submittable: true,
  fields: {
    subject: { type: 'string', required: true, label: { ar: 'الموضوع', en: 'Subject' } },
    customerId: {
      type: 'belongsTo',
      resource: 'customers',
      label: { ar: 'العميل', en: 'Customer' },
    },
    decidedOn: { type: 'date', label: { ar: 'التاريخ المعتمد', en: 'Decided on' } },
  },
  list: ['subject', 'customerId', 'decidedOn'],
  form: ['subject', 'customerId'],
  show: ['subject', 'customerId', 'decidedOn'],
  actions: ['view', 'create', 'update', 'submit', 'cancel'],
  validator: { validate: async (data: unknown) => data as RecordData },
})

test.group('Workflow decision steps in the approvals inbox', (group) => {
  let requester: UiActor
  let approver: UiActor
  let id: number
  let customerId: number
  group.setup(async () => {
    requester = await seedActor([{ subject: 'ui_requests', action: 'manage' }], { level: 0 })
    approver = await seedActor(
      [
        { subject: 'ui_requests', action: 'view' },
        { subject: 'customers', action: 'view' },
      ],
      { orgUnitId: requester.orgUnitId, fullName: 'قائد الفريق', level: 0 }
    )
    await knex().raw('DROP TABLE IF EXISTS ui_requests CASCADE')
    await createResourceTable(knex(), requests)
    const workflow = defineWorkflow({
      name: 'change_request',
      version: 1,
      resource: 'ui_requests',
      label: 'طلب تغيير',
      start: 'decide',
      steps: {
        decide: {
          type: 'decision',
          label: 'قرار قائد الفريق',
          assignees: { users: [approver.user.id] },
          outcomes: {
            approve: { label: 'اعتماد', next: 'approved' },
            reject: { label: 'رفض', next: 'rejected', comment: 'required' },
            reassign: {
              label: 'تحويل',
              next: 'approved',
              fields: ['customerId', 'decidedOn'],
            },
          },
        },
        approved: { type: 'end', outcome: 'approved' },
        rejected: { type: 'end', outcome: 'rejected', cancelDocument: true },
      },
    })
    const module: Module = {
      name: 'ui_decisions',
      label: { ar: 'قرارات الواجهة', en: 'UI decisions' },
      dependsOn: ['customers'],
      resources: [requests],
      workflows: [workflow],
    }
    registry.register([...modules, module])
    const customer = await kit().resources.systemSave(
      'customers',
      { name: `عميل التحويل ${approver.user.id}` },
      undefined,
      { actorId: requester.user.id }
    )
    customerId = Number(customer.id)
    const actor = await kit().actors.load(requester.user.id)
    const saved = await kit().resources.save('ui_requests', actor, {
      subject: 'تأجيل الزيارة',
      orgUnitId: requester.orgUnitId,
    })
    id = Number(saved.id)
    await kit().resources.transition('ui_requests', id, actor, 'submit', saved.version)
    const listeners = workflowListeners(registry, () => kit().workflows)
    for (const row of await knex()('outbox').whereNull('published_at')) {
      const event: DomainEvent = { id: row.id, event: row.event, payload: row.payload }
      for (const listener of listeners) await consumeEvent(knex(), listener, event)
      await knex()('outbox').where('id', row.id).update({ published_at: knex().fn.now() })
    }
    return async () => {
      registry.register(modules)
      await knex().raw('DROP TABLE IF EXISTS ui_requests CASCADE')
    }
  })

  test('the approver reassigns with the declared fields on the submitted request', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(approver.user)
    const inbox = await visit('/approvals')
    await inbox.getByText('قرار قائد الفريق').waitFor()
    for (const name of ['اعتماد', 'رفض', 'تحويل'])
      await inbox.getByRole('button', { name, exact: true }).waitFor()
    // A required reason is enforced before anything is sent.
    await inbox.getByRole('button', { name: 'رفض', exact: true }).click()
    const reject = inbox.getByRole('dialog', { name: 'تأكيد القرار: رفض' })
    await reject.getByRole('button', { name: 'رفض', exact: true }).click()
    await reject.getByText('اكتب ملاحظة القرار.').waitFor()
    await reject.getByRole('button', { name: 'تراجع' }).click()

    await inbox.getByRole('button', { name: 'تحويل', exact: true }).click()
    const dialog = inbox.getByRole('dialog', { name: 'تأكيد القرار: تحويل' })
    await dialog.getByRole('combobox', { name: 'العميل' }).click()
    await inbox.getByRole('option', { name: `عميل التحويل ${approver.user.id}` }).click()
    await dialog.getByLabel('التاريخ المعتمد', { exact: true }).fill('2026-11-15')
    await dialog.getByLabel('ملاحظة (اختيارية)').fill('يتولاها فريق آخر')
    await dialog.getByRole('button', { name: 'تحويل', exact: true }).click()
    await inbox.getByText('لا موافقات معلقة.').waitFor()

    const stored = await knex()('ui_requests').where('id', id).first()
    assert.equal(stored.customer_id, customerId)
    assert.equal(stored.doc_status, 1, 'the request stays submitted')
    const [run] = await kit().workflows.runsFor(
      'ui_requests',
      id,
      await kit().actors.load(requester.user.id)
    )
    assert.equal(run.outcome, 'approved')
    assert.deepInclude(run.history.find((entry) => entry.event === 'decided')?.detail, {
      outcome: 'reassign',
      comment: 'يتولاها فريق آخر',
    })
  })
})
