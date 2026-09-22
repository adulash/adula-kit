# Confirmed achievements — updated 2026-09-22

This ledger records demonstrated outcomes and their limits. It does not accept a whole plan phase: phase acceptance remains in [release-readiness.json](release-readiness.json), and the complete approved 1.0 scope remains the target.

| Outcome | Evidence | What is established |
|---|---|---|
| Resource framework and PostgreSQL authorization | [Current source review](evidence/implementation-review-2026-09-21.json), real PostgreSQL tests | Resource definitions, scoped CRUD, field restrictions, SQL/CASL parity, atomic inline writes, concurrency, activity/outbox and listener deduplication pass locally. |
| Generated Arabic interface and core administration | [Current source review](evidence/implementation-review-2026-09-21.json), [administrator UI](evidence/admin-ui-2026-09-20.json) | Browser workflows, generic field controls, modal forms/details, permissions, administrator protection and calendar preferences pass. Human RTL acceptance and k6 budgets remain open. |
| Independent installation and application creation | [Initial setup acceptance](evidence/initial-setup-2026-09-20.json), [creator acceptance](evidence/create-app-2026-09-19.json) | Packed installation, a fresh application, project-owned UI/identity preservation and repeated setup were exercised. This is not a genuine published minor upgrade or a production consumer. |
| Initial setup center and operational evidence | [Initial setup acceptance](evidence/initial-setup-2026-09-20.json) | Identity review, receipt confirmation, notification/storage probes and protected configuration-specific evidence were exercised. |
| Real external mail receipt and password recovery | [External mail/runtime evidence](evidence/external-mail-runtime-2026-09-21.json) | Resend accepted the corrected sending identity, the owner confirmed Gmail receipt, and audit events establish password reset followed by successful login. |
| Real S3 setup probe | [S3 setup](evidence/s3-setup-2026-09-21.json) | A private disposable object was written, read with exact bytes and deleted using the configured AWS account. This probe alone does not establish application attachment recovery. |
| Offsite database backup and isolated recovery | [Database restore](evidence/offsite-database-restore-2026-09-21.json) | Snapshot objects were uploaded/downloaded with matching checksums; restored account, role and settings records were verified in isolation. |
| Offsite recovery of a record and local attachment | [Attachment restore](evidence/offsite-attachment-restore-2026-09-21.json) | A snapshot fetched from S3 restored a bound record and its local file with exact bytes; missing/corrupt-file cases fail. The attachment's source disk in this exercise was local. |
| Source-S3 attachment and recovery acceptance | [Source-S3 exercise](evidence/source-s3-acceptance-2026-09-21.json) | Real HTTP upload/binding, access denials, filesystem/S3 migration and offsite recovery of three files passed. Originals were deleted before restoration; a fresh application using the restored database served exact bytes with authorization preserved. Operational command integration was subsequently verified on 2026-09-22 (see below). |
| Optional OAuth scope | [ADR 021](decisions/021-optional-oauth.md) | The owner excluded OAuth from base release blockers. No successful external OAuth login is claimed. |
| Educational module isolation | [ADR 017](decisions/017-test-only-examples-and-release-gates.md), current fixture-isolation tests | Customers/orders/tasks remain test-only; normal application registries and production frontend assets exclude them. |

## Operational repair verification — 2026-09-22

The shipped source-S3 backup and recovery commands passed direct external acceptance, including missing-source rejection and preservation of original keys during the monthly drill. Build, typecheck, lint, boundaries and 295 local tests passed, with five additional release guards. Docker service startup, mixed-disk backup/recovery and the manually invoked scheduler drill subsequently passed; see [Docker acceptance](evidence/docker-backup-2026-09-22.json). Natural daily/monthly scheduling remains unverified. See [dated evidence](evidence/operational-backup-2026-09-22.json).

## Earlier local verification — 2026-09-21

The review reran `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm check:boundaries` and `pnpm test:release` on Node 24.21.0 and PostgreSQL 17.6. All passed: 130 kit, 136 reference, four calendar and 12 creator tests (282), plus five release-guard tests. The working tree was clean after generated formatting was restored. Independent consumer/creator packaging and external provider receipt were reviewed from their dated evidence rather than rerun during that review.

After adding the explicit source-S3 harness and updating this documentation, all six commands passed again with the same 282 local tests and five release guards. The external S3 exercise separately passed one HTTP phase against the source database and one against the restored database. Its evidence records the exact harness hashes, file hashes, cleanup, retained offsite snapshots and the production-integration boundary.

## Remaining acceptance boundary

Source-S3 recovery is integrated into the shipped commands, COMPLETE is published after verified artifact transfer, and the scheduler mounts the backup volume. Direct real-S3 recovery and negative cases are recorded in [operational backup evidence](evidence/operational-backup-2026-09-22.json). Staging, actual scheduled daily backup and monthly recovery, performance, human RTL review, the genuine independent upgrade, later business/workflow features and production/public release remain separate gates.

See [implementation status](implementation-status.md), [remaining gaps](../KIT_GAPS.md) and [1.0 acceptance](acceptance-1.0.md). No merge, push, publication or external deployment is implied by this ledger.

## Schedule follow-up — 2026-09-22

After commit f342707, accelerated real Docker timers produced two offsite snapshots and 13 successful bound-record/local/S3 restore drills. Five deliberately incomplete-archive attempts failed without advancing last success, then recovery resumed automatically. The monitor scope check failed: backup:verify ignored BACKUP_S3_PREFIX and the assessor did not require COMPLETE. Those findings were subsequently repaired; see [monitor repair](evidence/backup-monitor-repair-2026-09-22.json). The original run is retained in [schedule evidence](evidence/scheduled-backup-2026-09-22.json). No natural calendar or staging acceptance is claimed.

The monitor repair passed build, types, all 297 local tests, lint, boundaries and five release guards. Four real-S3 command cases verified empty-prefix isolation, rejection before COMPLETE, acceptance after COMPLETE and sibling-prefix rejection; the setup fingerprint changed with the prefix. Accelerated scheduler invocations and the standalone rebuilt Docker image reproduced correct and incorrect-prefix outcomes.
