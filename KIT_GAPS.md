# Kit gaps

Updated 2026-09-23. Resolved items are recorded in docs/implementation-status.md. This file lists remaining work only.

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

## GAP-004 — Phase 2 performance budget and the vertical slice

Needed by: the gate before phase 3.
Implemented: the generic ResourcePage/DataTable/ResourceForm/ResourceShow with every field control, belongsTo search, inline rows, virtualization above 200 rows, CSV export, deferred activity and children, the page override rule, the fixed core administration screens, the route scan, and browser coverage of all of it with RTL screenshots in `.work/screenshots/`.
Verified locally: a separate archive-installed disposable medical consumer, four generated resources, 61 HTTP tests, preserved component/page customizations and real database-plus-bound-file recovery. The owner waived company identity for this test. The 100000-row, 50-user k6 run completed 5805 successful lists and saves with no HTTP failures; actor/Ability cache timing and invalidation passed.
Remaining: list p95 504.83ms and save p95 463.00ms exceed the <300/<200ms budgets. A 2026-09-24 rerun after the audit hardening was worse (1140/1060ms, 3713 samples; docs/evidence/medical-consumer-2026-09-24.json); pool size, host load and Node version changed together, so the cause is not yet attributed. Staging measurement, human RTL approval (including localized date order on the detail view), a genuine published minor-version upgrade and council 1 remain outstanding.
Next: profile request/query/pool contention and rerun on actual staging hardware, hold visual review, and exercise the genuine upgrade. No threshold was relaxed. Local installation/restore and green functional tests do not accept the phase.

## GAP-005 — Later approved roadmap

Needed by: the plan's 1.0 completion criterion.
Remaining: phases 3–7 business features, the XState engine, the five reviewer skills, independent framework-consumer integration/runtime acceptance and public release (ADR 024 removes a permanent medical product).
Scope: the owner explicitly selected full 1.0 acceptance. Deleted educational modules must stay out of normal operation; isolated fixtures or independent applications provide feature consumers. See docs/acceptance-1.0.md and docs/release-readiness.json.
Constraint: the plan explicitly forbids phase 3 before the independently upgraded and restored phase 2 slice passes.
Next: follow the framework gates in order under ADR 024. The owner authorized the experimental alpha channel (currently 0.2.0-alpha.4); latest remains on 0.2.0-alpha.1 by the ADR 024 amendment and next remains absent.

## Schedule follow-up — 2026-09-22

Accelerated Docker timer dispatch, repeated bound-record/local/S3 restore, missing-archive rejection and automatic recovery passed. The two monitoring defects found in that run were repaired: listing and assessment honor BACKUP_S3_PREFIX, and COMPLETE is required in the same recent snapshot. Regression tests and real-provider command checks passed; see docs/evidence/backup-monitor-repair-2026-09-22.json. Evidence: docs/evidence/scheduled-backup-2026-09-22.json. Natural daily/monthly machine evidence remains separate from owner attestation; selected local Docker staging is now recorded in the newer evidence.
