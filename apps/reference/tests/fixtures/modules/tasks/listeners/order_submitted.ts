import { recordMutation, type Listener } from '@adula/kit'

/** A trusted system action caused by an authorized submission; never an HTTP entrypoint. */
export const orderSubmitted: Listener = {
  name: 'tasks.create_submission_followup',
  event: 'orders.orders.submitted',
  async handle(event, trx) {
    const order = await trx('orders').where('id', Number(event.payload.id)).first()
    if (!order || order.deleted_at || order.doc_status !== 1) return
    const actorId = Number(event.payload.actorId)
    const [task] = await trx('tasks')
      .insert({
        title: `متابعة الطلب ${order.number}`,
        order_id: order.id,
        org_unit_id: order.org_unit_id,
        done: false,
        created_by: actorId,
        updated_by: actorId,
      })
      .returning('id')
    await recordMutation(trx, {
      module: 'tasks',
      resource: 'tasks',
      id: task.id,
      actorId,
      action: 'create',
      fields: ['title', 'orderId', 'done'],
    })
  },
}
