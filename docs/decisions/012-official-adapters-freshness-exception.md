# ADR 012: Official AdonisJS adapters past the six-month freshness rule

Status: accepted 2026-09-18.

The plan's dependency rule requires a package to declare `@adonisjs/core` ^7, to have tests and to have been published within six months. Two packages the plan itself selects miss the third condition on the day of integration:

| Package | Version | Last publish | Declares core ^7 | Role in the plan |
|---|---|---|---|---|
| @adonisjs/drive | 4.0.0 | 2026-02-25 | yes | Attachments and `adula:storage:migrate` (sections 2, 10, 16) |
| @adonisjs/limiter | 3.0.1 | 2026-03-13 | yes | Authentication and `/api` throttling (sections 16, 18) |

Decision: both are installed at exact versions. They are first-party AdonisJS packages maintained with the framework itself, the plan names them as the chosen adapters, and no community alternative passes the same rule. The freshness rule continues to apply to third-party packages; the exception is limited to first-party `@adonisjs/*` packages that declare core ^7.

Also installed at exact versions, all within the rule: @adonisjs/ally 6.3.0 (2026-04-13), @adonisjs/mail 10.4.0 (2026-07-05, SMTP transport only, no external mail service) and @jrmc/adonis-attachment 5.2.1 (2026-09-12). The S3 disk uses the AWS SDK that Drive itself requires.

Consequences: doctor keeps reporting the exact installed versions; a future first-party release replaces the exception without a plan change. Attachment files stay private on every disk and are served only through the authorized attachment route.
