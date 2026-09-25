import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { listenForNotifications } from '@adula/kit'

/** A user's notification channel carries only ids; the bell refetches what it may read. */
transmit.authorize<{ id: string }>('notifications/:id', (ctx: HttpContext, { id }) => {
  return ctx.auth.user?.id === Number(id)
})

const stop = listenForNotifications(
  db.connection().getWriteClient(),
  (signal) => {
    void transmit.broadcast(`notifications/${signal.userId}`, { id: signal.id })
  },
  { onError: (error) => logger.warn({ err: error }, 'notification listener interrupted') }
)
app.terminating(stop)
