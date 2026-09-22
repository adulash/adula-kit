# ADR 004: Distribution, operations and agent boundaries

Status: accepted. Source: plan sections 2, 9–18.

Backend code ships as @adula/kit; React 19/Inertia 3 UI components will ship as a private shadcn registry and be copied into consumers. Arabic UI, English code and agent documentation. The registry-owned add command is the only supported component installation path.

Jobs use an adapter for @nemoventures/adonis-jobs; adonisjs-scheduler runs as one service. Attachments will use Drive and @jrmc/adonis-attachment, local by default with relative paths. Authentication uses official Adonis flows and later Ally/otpauth; no custom cryptography.

Deploy with Docker Compose and Caddy: build, doctor, database plus uploads backup, migration, start, health verification. Offsite backup configuration is mandatory in production. Public npm publication, GitHub visibility, organization registration and production deployment are external gates, not implicit local setup.

No phase 3 work before the phase 2 independent consumer, upgrade and attachment-restore acceptance test. No 1.0 claim before every section 14 feature has a consumer and passing test.
