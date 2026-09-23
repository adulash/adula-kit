import scheduler from 'adonisjs-scheduler/services/main'
import db from '@adonisjs/lucid/services/db'
import { Settings } from '@adula/kit'
// Exactly one scheduler process is deployed. The worker owns outbox publication.
scheduler.command('backup:verify').hourly().withoutOverlapping()
// The monthly drill restores the latest snapshot and opens a record with its attachment.
scheduler.command('backup:restore-test').monthly().withoutOverlapping()
// Uploads abandoned before their record was saved would otherwise fill the storage disk.
scheduler.command('adula:uploads:prune').daily().withoutOverlapping()
scheduler
  .call(async () => {
    await new Settings(db.connection().getWriteClient()).set(
      'scheduler.heartbeat',
      new Date().toISOString()
    )
  })
  .everyThirtySeconds()
  .immediate()
  .withoutOverlapping()
