import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { deliverNotificationMail } from '@adula/kit'

/** Sends pending templated notification e-mails through the configured mailer. */
export function deliverNotificationEmails() {
  return deliverNotificationMail(db.connection().getWriteClient(), async (message) => {
    await mail.send((email) => {
      email
        .to(message.to, message.name ?? undefined)
        .subject(message.subject)
        .text(message.text)
    })
  })
}
