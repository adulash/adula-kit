import db from '@adonisjs/lucid/services/db'
import { AdonisJobs, publishOutbox, type DomainEvent } from '@adula/kit'
import DomainEventJob from '../jobs/domain_event_job.js'

export const jobs = new AdonisJobs({
  'adula.domain_event': async (data, id) => {
    const event: DomainEvent = {
      id,
      event: String(data.event),
      payload: data.payload as DomainEvent['payload'],
    }
    return await DomainEventJob.dispatch(event).with('jobId', id)
  },
})
export function publishEvents() {
  return publishOutbox(db.connection().getWriteClient(), jobs)
}
