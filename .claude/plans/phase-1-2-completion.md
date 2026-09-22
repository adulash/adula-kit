# Phase 1–2 completion plan (2026-09-18)

Historical implementation note. Follow docs/implementation-status.md, docs/acceptance-1.0.md and ADR 017 for current acceptance and the removal of educational modules from normal operation. The @adula scope is now reserved; publication and external acceptance remain pending.

Goal: close the locally achievable acceptance items of phases 1 and 2 of `adula-kit-plan.md` with real consumers and green tests, without Docker, staging, S3, npm or GitHub (those stay in KIT_GAPS.md).

## Decisions taken up front

* Drive 4.0.0 and limiter 3.0.1 are installed under ADR 012 (first-party AdonisJS adapters named by the plan).
* Installed at exact versions in `apps/reference`: @jrmc/adonis-attachment 5.2.1, @adonisjs/drive 4.0.0 (+ AWS SDK for the s3 disk), @adonisjs/limiter 3.0.1, @adonisjs/ally 6.3.0, @adonisjs/mail 10.4.0 (SMTP only).
* Files are private on every disk; downloads go through an authorized route only.
* Parallel test isolation: `DB_DATABASE=adula_<x>_test PORT=<p> APP_URL=http://127.0.0.1:<p> REDIS_TEST_DB=<n>` for the reference app, `KIT_TEST_DATABASE=adula_<x>_test` for kit tests, memory limiter store in tests.

## Wave 1 (parallel workstreams, disjoint ownership)

| Stream | Scope | Isolation |
|---|---|---|
| A attachments | kit `attachments` table + service, ownership validation in `ResourceService`, upload/download routes, `adula:storage:migrate`, orders `contract` field, restore of record + file, tests | db `_a`, port 3341, redis 11 |
| B authentication | recovery (mail), session revocation/activity, Ally providers, limiter on auth, activity log, profile/sessions pages, tests | db `_b`, port 3342, redis 12 |
| C fixed admin screens | users, roles matrix + condition editor, org tree with moves, activity, jobs, settings, notifications, backup banner; kit core services; tests | db `_c`, port 3343, redis 13 |
| D generic resource UI | all field controls, belongsTo search, inline hasMany, virtualization/keyset scroll/CSV, deferred show sections, action buttons, page override rule, browser tests | db `_d`, port 3344, redis 14 |

## Wave 2 (after wave 1 is merged and the full suite is green)

* E: exhaustive generated Tuyau request/response contracts for all field kinds; typed controller responses.
* F: `adula:seed --rows`, `adula:gaps report`, k6 workload script (unexecuted locally), capabilities regeneration, ESLint rule coverage.
* G: medical-assets vertical slice in the independent consumer harness with a customized component and page, minor-version upgrade (0.1.0 → 0.2.0) and attachment restore.
* Docs: implementation status, KIT_GAPS, CHANGELOG, ADRs 012+.

## Out of scope this session (external resources)

Docker/container verification, staging deploy, offsite S3 backup, npm publication, GitHub push, remote CI execution, phases 3–7.
