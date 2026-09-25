import type { Knex } from 'knex'

export type DomainEvent = { id: string; event: string; payload: Record<string, unknown> }
export type Listener = {
  name: string
  /** The exact event name, or '*' for a catch-all listener (for example webhooks). */
  event: string
  handle(event: DomainEvent, trx: Knex.Transaction): Promise<void>
}
export interface Jobs {
  dispatch(name: string, payload: Record<string, unknown>, options: { id: string }): Promise<void>
}

export async function publishOutbox(db: Knex, jobs: Jobs, limit = 100) {
  return db.transaction(async (trx) => {
    const events = await trx('outbox')
      .whereNull('published_at')
      .orderBy('created_at')
      .limit(limit)
      .forUpdate()
      .skipLocked()
    for (const event of events) {
      // Queue implementations must use this stable ID. A crash after publish may redeliver.
      await jobs.dispatch('adula.domain_event', event, { id: event.id })
      await trx('outbox')
        .where('id', event.id)
        .update({ published_at: trx.fn.now(), attempts: event.attempts + 1 })
    }
    return events.length
  })
}
export async function consumeEvent(db: Knex, listener: Listener, event: DomainEvent) {
  if (listener.event !== '*' && listener.event !== event.event) return false
  return db.transaction(async (trx) => {
    const inserted = await trx('processed_events')
      .insert({ event_id: event.id, listener: listener.name })
      .onConflict(['event_id', 'listener'])
      .ignore()
      .returning('event_id')
    if (!inserted.length) return false
    await listener.handle(event, trx)
    return true
  })
}
