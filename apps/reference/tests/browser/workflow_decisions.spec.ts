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

// A change request that the team leader approves, rejects with a reason, or returns to the
// requester (#42). A decision never edits the submitted request.
const requests = defineResource({
  name: 'ui_requests',
  label: { ar: 'طلبات التغيير', en: 'Change requests' },
  model: BaseModel,
  scoped: true,
  submittable: true,
  fields: {
    subject: { type: 'string', required: true, label: { ar: 'الموضوع', en: 'Subject' } },
  },
  list: ['subject'],
  form: ['subject'],
  show: ['subject'],
  actions: ['view', 'create', 'update', 'submit', 'cancel'],
  validator: { validate: async (data: unknown) => data as RecordData },
})

test.group('Workflow decision steps in the approvals inbox', (group) => {
  let requester: UiActor
  let approver: UiActor
  let id: number
  group.setup(async () => {
    requester = await seedActor([{ subject: 'ui_requests', action: 'manage' }], { level: 0 })
    approver = await seedActor([{ subject: 'ui_requests', action: 'view' }], {
      orgUnitId: requester.orgUnitId,
      fullName: 'قائد الفريق',
      level: 0,
    })
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
            back: { label: 'إعادة للمراجعة', next: 'review', comment: 'required' },
          },
        },
        review: {
          type: 'decision',
          label: 'مراجعة مقدم الطلب',
          assignees: { users: [requester.user.id] },
          outcomes: {
            resubmit: { label: 'إعادة الإرسال', next: 'decide' },
            withdraw: { label: 'سحب الطلب', next: 'rejected' },
          },
        },
        approved: { type: 'end', outcome: 'approved' },
        rejected: { type: 'end', outcome: 'rejected', cancelDocument: true },
      },
    })
    const module: Module = {
      name: 'ui_decisions',
      label: { ar: 'قرارات الواجهة', en: 'UI decisions' },
      dependsOn: [],
      resources: [requests],
      workflows: [workflow],
    }
    registry.register([...modules, module])
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

  test('the approver returns the request with a reason, then approves it', async ({
    browserContext,
    visit,
    assert,
  }) => {
    await browserContext.loginAs(approver.user)
    let inbox = await visit('/approvals')
    await inbox.getByText('قرار قائد الفريق').waitFor()
    for (const name of ['اعتماد', 'رفض', 'إعادة للمراجعة'])
      await inbox.getByRole('button', { name, exact: true }).waitFor()
    // A required reason is enforced before anything is sent.
    await inbox.getByRole('button', { name: 'إعادة للمراجعة', exact: true }).click()
    const back = inbox.getByRole('dialog', { name: 'تأكيد القرار: إعادة للمراجعة' })
    await back.getByRole('button', { name: 'إعادة للمراجعة', exact: true }).click()
    await back.getByText('اكتب ملاحظة القرار.').waitFor()
    await back.getByLabel('ملاحظة').fill('أرفق مبرر التأجيل')
    await back.getByRole('button', { name: 'إعادة للمراجعة', exact: true }).click()
    await inbox.getByText('لا موافقات بانتظار قرارك.').waitFor()

    // The earlier step is open again for the requester, who sends it back.
    await browserContext.clearCookies()
    await browserContext.loginAs(requester.user)
    inbox = await visit('/approvals')
    await inbox.getByText('مراجعة مقدم الطلب').waitFor()
    await inbox.getByRole('button', { name: 'إعادة الإرسال', exact: true }).click()
    await inbox
      .getByRole('dialog', { name: 'تأكيد القرار: إعادة الإرسال' })
      .getByRole('button', { name: 'إعادة الإرسال', exact: true })
      .click()
    await inbox.getByText('لا موافقات بانتظار قرارك.').waitFor()

    await browserContext.clearCookies()
    await browserContext.loginAs(approver.user)
    inbox = await visit('/approvals')
    await inbox.getByRole('button', { name: 'اعتماد', exact: true }).click()
    await inbox
      .getByRole('dialog', { name: 'تأكيد القرار: اعتماد' })
      .getByRole('button', { name: 'اعتماد', exact: true })
      .click()
    await inbox.getByText('لا موافقات بانتظار قرارك.').waitFor()

    const stored = await knex()('ui_requests').where('id', id).first()
    assert.equal(stored.doc_status, 1, 'the request stays submitted and unchanged')
    assert.equal(stored.subject, 'تأجيل الزيارة')
    const [run] = await kit().workflows.runsFor(
      'ui_requests',
      id,
      await kit().actors.load(requester.user.id)
    )
    assert.equal(run.outcome, 'approved')
    assert.deepInclude(
      run.history.find((entry) => entry.event === 'decided' && entry.detail.outcome === 'back')
        ?.detail,
      { comment: 'أرفق مبرر التأجيل', next: 'review' }
    )
  })
})
