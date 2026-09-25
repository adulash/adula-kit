import { BaseCommand } from '@adonisjs/core/ace'

export default class AdulaWorker extends BaseCommand {
  static commandName = 'adula:worker'
  static description = 'Run the queue consumer and transactional outbox publisher'
  static options = { startApp: true, staysAlive: true }
  async run() {
    const { publishEvents } = await import('#services/events')
    const { deliverNotificationEmails } = await import('#services/notification_mail')
    const { kit } = await import('#services/kit')
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { Settings } = await import('@adula/kit')
    const worker = await this.kernel.exec('queue:work', [])
    if (worker.error) throw worker.error
    let active: Promise<void> | undefined
    let stopped = false
    const tick = () => {
      if (active || stopped) return
      active = (async () => {
        try {
          await publishEvents()
          await deliverNotificationEmails()
          await kit().workflows.tick()
          await kit().imports.process()
          await kit().webhooks.deliver(async (url, init) => {
            const response = await fetch(url, { method: 'POST', redirect: 'manual', ...init })
            return { status: response.status }
          })
          await new Settings(db.connection().getWriteClient()).set(
            'worker.heartbeat',
            new Date().toISOString()
          )
        } catch (error) {
          this.logger.error(error instanceof Error ? error.message : String(error))
        }
      })().finally(() => {
        active = undefined
      })
    }
    const timer = setInterval(tick, 1000)
    this.app.terminating(async () => {
      stopped = true
      clearInterval(timer)
      await active
    })
    tick()
  }
}
