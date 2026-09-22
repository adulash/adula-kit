import { BaseCommand } from '@adonisjs/core/ace'

export default class AdulaOutbox extends BaseCommand {
  static commandName = 'adula:outbox'
  static description = 'Publish one locked batch of durable events to the queue'
  static options = { startApp: true }
  async run() {
    const { publishEvents } = await import('#services/events')
    this.logger.info(`Published ${await publishEvents()} events`)
  }
}
