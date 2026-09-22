# ADR 006: Runtime integration and dependency audit

Status: accepted for the local foundation. Staging remains a separate gate.

The reference app uses @adonisjs/cache 2.1.0 with memory L1 and Redis L2. Every actor lookup first reads the database authorization revision, so role edits and organizational changes select a new cache key across processes. Cached records expire after five minutes. Tests isolate Redis DB 15 and their own key prefix.

The kit Jobs interface is adapted to @nemoventures/adonis-jobs 2.2.0 with BullMQ 5.81.5. The adapter's supported BullMQ major is 5, even though the registry's latest major is 6. The reference worker runs the SKIP LOCKED publisher and consumers together. Completed queue records can be pruned; SQL processed_events remains the authority for listener deduplication. Restoring a snapshot requires stopping writers, clearing stale queue/cache state and replaying the durable outbox.

One adonisjs-scheduler 2.8.0 process performs periodic backup-object checks and emits a heartbeat. Object verification checks database, uploads and checksum presence/age in one snapshot. It does not replace a checksum-verified restore or the plan's record-and-attachment acceptance exercise.

The dependency audit exposed vulnerable transitive DOMPurify 3.2.7 through the unused QueueDash/Monaco UI, and uuid 8.3.2 through node-cron. Scoped pnpm overrides pin DOMPurify 3.4.15 and uuid 11.1.1. node-cron uses the compatible CommonJS v4 UUID API; scheduler startup/heartbeat is checked with the override. No installed kit internals are patched. Re-evaluate these overrides when upstream packages update.

Primary sources: [Adonis cache](https://github.com/adonisjs/cache), [adonis-jobs](https://github.com/nemoengineering/adonis-jobs), [scheduler](https://github.com/KABBOUCHI/adonisjs-scheduler). Exact versions, peer ranges and modification dates were checked in npm metadata before installation.
