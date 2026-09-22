import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const smtpUser = env.get('SMTP_USERNAME')
const smtpPassword = env.get('SMTP_PASSWORD')

/**
 * SMTP only: no external mail service. Tests fake the mailer, and a local
 * relay on 127.0.0.1:1025 is the development default.
 */
const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER') ?? 'smtp',
  from: {
    address: env.get('MAIL_FROM_ADDRESS') ?? 'no-reply@localhost',
    name: env.get('MAIL_FROM_NAME') ?? 'عدولة',
  },
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST') ?? '127.0.0.1',
      port: env.get('SMTP_PORT') ?? 1025,
      secure: env.get('SMTP_SECURE') ?? env.get('SMTP_PORT') === 465,
      requireTLS: env.get('SMTP_REQUIRE_TLS') ?? env.get('NODE_ENV') === 'production',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      ...(smtpUser && smtpPassword
        ? { auth: { type: 'login' as const, user: smtpUser, pass: smtpPassword } }
        : {}),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
