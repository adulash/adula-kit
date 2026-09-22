import { Job } from '@nemoventures/adonis-jobs'
import db from '@adonisjs/lucid/services/db'
import { consumeEvent, type DomainEvent } from '@adula/kit'
import { listeners } from '#start/listeners'

export default class DomainEventJob extends Job<DomainEvent, void> {
  static nameOverride = 'adula.domain_event'
  async process() {
    for (const listener of listeners) {
      await consumeEvent(db.connection().getWriteClient(), listener, this.data)
    }
  }
}
