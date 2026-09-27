import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { deliverNotificationMail } from '@adula/kit'
import env from '#start/env'

/** Sends pending templated notification e-mails through the configured mailer. */
export function deliverNotificationEmails() {
  return deliverNotificationMail(db.connection().getWriteClient(), async (message) => {
    await mail.send((email) => {
      email
        .to(message.to, message.name ?? undefined)
        .subject(message.subject)
        .text(
          message.target
            ? `${message.text}\n\n${new URL(`/resources/${message.target.resource}/${message.target.recordId}`, env.get('APP_URL'))}`
            : message.text
        )
    })
  })
}
