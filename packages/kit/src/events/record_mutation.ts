import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import type { Action } from '../resource/types.js'

/** Infrastructure writes for a module-owned mutation, inside its existing transaction. */
export async function recordMutation(
  trx: Knex.Transaction,
  mutation: {
    module: string
    resource: string
    id: unknown
    actorId: number
    /** The administrator acting as actorId, when impersonating. */
    impersonatorId?: number
    action: Action
    fields: string[]
  }
) {
  const past: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
    submit: 'submitted',
    cancel: 'cancelled',
    amend: 'amended',
  }
  if (!past[mutation.action]) throw new Error('Unsupported mutation event')
  const eventId = randomUUID()
  const event = `${mutation.module}.${mutation.resource}.${past[mutation.action]}`
  const payload = {
    resource: mutation.resource,
    id: mutation.id,
    actorId: mutation.actorId,
    ...(mutation.impersonatorId ? { impersonatorId: mutation.impersonatorId } : {}),
  }
  await trx('activities').insert({
    resource: mutation.resource,
    record_id: mutation.id,
    actor_id: mutation.actorId,
    action: mutation.action,
    changes: JSON.stringify({
      fields: mutation.fields,
      ...(mutation.impersonatorId ? { impersonatedBy: mutation.impersonatorId } : {}),
    }),
  })
  await trx('outbox').insert({
    id: eventId,
    event,
    payload: JSON.stringify(payload),
  })
  // A durable submission envelope, not an executing workflow definition.
  // The later workflow engine can claim it using the same outbox event ID.
  if (mutation.action === 'submit')
    await trx('workflow_runs').insert({
      id: eventId,
      resource: mutation.resource,
      record_id: mutation.id,
      definition: event,
      definition_version: 1,
      snapshot: JSON.stringify({ kind: 'submission', schemaVersion: 1, eventId, ...payload }),
      status: 'pending_definition',
    })
}
