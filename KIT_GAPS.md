# Kit gaps

Updated 2026-09-25. Resolved items are recorded in docs/implementation-status.md. This file lists remaining work only.

The [2026-09-22 npm acceptance review](docs/npm-acceptance-review-2026-09-22.md)
records the current operational/phase 2 audit and the concrete acceptance sequence.
The k6 workload now requires distinct per-user sessions and an explicit independent
consumer fixture, checks preloaded relations and created records, and rejects failed
functional samples. The independent disposable consumer, seed and local recovery
now pass, and cached actor/Ability p95 is 1.25ms. The first real local k6 run failed
both latency budgets (list 504.83ms, save 463.00ms); staging performance remains
unaccepted. See [dated evidence](docs/evidence/medical-consumer-2026-09-22.json).
The synthetic upgrade harness now requires
`--synthetic` and rejects ADULA_PREVIOUS_VERSION; it must not be counted as a genuine
published-version upgrade. See the local [acceptance execution packet](docs/release-acceptance-runbook.md)
and `pnpm release:status` for both channel blockers and the full remaining scope.

## GAP-001 — Prove storage and authentication against real infrastructure

Needed by: phase 1 acceptance.
Implemented: the full session lifecycle (login/signup/logout, password recovery by mail, session listing and revocation, disabled accounts, Ally providers, rate limiting, auth activity); attachment ownership, upload, authorized download, `adula:storage:migrate` between disks and the `backup:restore-test` drill that opens a restored record with its file. The dependency exception for Drive 4.0.0 and limiter 3.0.1 is recorded in docs/decisions/012.
Verified on 2026-09-21: real source-S3 attachment upload/binding, authorized downloads and access denials; S3-to-filesystem-to-S3 migration; offsite snapshot upload/download; deletion of original test objects; restoration into a second PostgreSQL database; and byte-exact HTTP downloads from the restored application. The explicit harness and dated results are in docs/evidence/source-s3-acceptance-2026-09-21.json.
External SMTP was exercised through Resend using a verified sending domain. The owner confirmed Gmail receipt, and the application persisted that confirmation. A separate recovery message was accepted; the owner completed password reset and a subsequent successful login, as recorded by application audit events. See docs/evidence/external-mail-runtime-2026-09-21.json. SMTP evidence does not accept the remaining storage/recovery gates.
Remaining/next: exercise natural daily/monthly scheduling and staging recovery. Local Docker services and recovery passed (docs/evidence/docker-backup-2026-09-22.json). The shipped backup:create, backup:restore-files and backup:restore-test commands now handle source-S3 files; direct real-provider command acceptance is recorded in docs/evidence/operational-backup-2026-09-22.json. Real filesystem/S3 migration compatibility is now verified without a service code change. OAuth is optional and excluded from base release blockers by ADR 021; no external provider verification is claimed.

The earlier local-attachment offsite exercise remains recorded separately (docs/evidence/offsite-attachment-restore-2026-09-21.json). The container script now delegates to backup:create, which publishes COMPLETE last after downloading and checksum-verifying every uploaded artifact. The scheduler mounts /backups read-only and retains its writable uploads mount. Local container execution passed on 2026-09-22; natural scheduled execution remains unverified.

## GAP-002 — Generated Tuyau contracts and a real minor-version upgrade

Needed by: generated entities and the independent phase 2 consumer.
Implemented: generated HTTP fixtures for every reference resource with persisted values, scope isolation, uniqueness, conflicts and soft deletion; all-field service fixtures; attachment field contracts; independent configure/install/module commands; Node-based consumer orchestration; pinned CI starter configuration.
Remaining: the dynamic resource controller still has an unknown Tuyau response type, so request/response assertions per field kind are not derived from the route types; remote CI is now executing through PR #1; JSON, attachment and hasMany authorization predicates remain explicitly unsupported.
Next: type the dynamic controller's responses, then prove a genuinely different published minor version in a consumer that customized a component and a page. Reinstalling local archives or synthesizing a predecessor from current source is not that upgrade test.

## GAP-003 — Operational acceptance and external resources

Needed by: mandatory staging and offsite restoration gates.
Implemented: isolated PostgreSQL 17/Redis, production assets, Compose/Caddy, backup-object checks, watchdog, restore reconciliation and a scheduled monthly restore drill.
Current: the owner selected local Docker staging and lifted the GitHub hold. The
production build is running on loopback with separate volumes, healthy services,
successful initial signup/install/doctor and startup offsite backup. An empty-core
manual restore passed; it is not new bound-file or natural-monthly evidence. See
docs/evidence/local-staging-2026-09-22.json. The owner separately attests testing
operations. No external host is required for the selected environment.
Resolved 2026-09-23: the repository is public, main requires passing CI through PRs,
and the three packages are published on npm with signed provenance through trusted
publishing (docs/evidence/alpha-publication-2026-09-23.json).
Remaining: natural scheduled backup/restore evidence on staging. No external
production-capacity or public TLS claim is made.

## GAP-004 — Performance on staging hardware

Needed by: 2.0 (the 1.0 budget passed on CI hardware).
Resolved for 1.0: the 100000-row, 50-user k6 workload passes on a GitHub runner with the compiled build: list p95 152.15 ms, save p95 134.71 ms, 16476 checks without failure ([evidence](docs/evidence/phase5-performance-2026-09-25.json)). Earlier failures (504.83/463.00 ms and 1140/1060 ms) measured the development server.
Remaining: a run on staging hardware with `NODE_ENV=production`, and a scheduled weekly k6 run (the Performance workflow runs on demand and when the harness changes).

## GAP-005 — Items deferred to 2.0

Needed by: 2.0.
Deferred by the owner (ADR 027): two-factor authentication with its human ASVS review (the reverted implementation is commit f7c68b6), the natural daily backup and monthly restore-test observations and an operated production consumer.
Also open: `make restore` reopens traffic right after reconcile without the acceptance check that restore.sh advises; restored files are root-owned (0644); impersonation human review (deferred by the owner; automated review only in 1.0), the timed feasibility exercise, the weekly agent test, an independent repetition of the fourth-module exercise from published packages, killing a real worker process in the workflow crash test, and API contract coverage for the `./mcp`, `./provider`, `./commands` and `./eslint` exports.

## Schedule follow-up — 2026-09-22

Accelerated Docker timer dispatch, repeated bound-record/local/S3 restore, missing-archive rejection and automatic recovery passed. The two monitoring defects found in that run were repaired: listing and assessment honor BACKUP_S3_PREFIX, and COMPLETE is required in the same recent snapshot. Regression tests and real-provider command checks passed; see docs/evidence/backup-monitor-repair-2026-09-22.json. Evidence: docs/evidence/scheduled-backup-2026-09-22.json. Natural daily/monthly machine evidence remains separate from owner attestation; selected local Docker staging is now recorded in the newer evidence.

## GAP-006 — Spreadsheet (XLSX) import

Needed by: phase 3 import from spreadsheets exported by Excel.
Tried: the plan names exceljs for XLSX parsing.
Blocked because: exceljs 4.4.0 was last published 2024-12-20, failing the plan's
section 3 dependency rule (a release within six months).
Proposed kit change: accept XLSX once a maintained parser passes the rule, reusing
ImportBatches.create with the parsed header and rows.
Workaround: export the sheet as CSV (UTF-8); CSV import is implemented and tested.
