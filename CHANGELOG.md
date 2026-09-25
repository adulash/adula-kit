# Changelog

## Unreleased — toward 1.0.0

Phase 2 accepted by owner attestation (ADR 025; the k6 budget remains an open,
recorded deviation). Phases 3–5 implemented with consumers and PostgreSQL tests.
All new kit tables arrive through additive migrations (`kit_collaboration`,
`kit_assignments`, `kit_messaging`, `kit_webhooks`, `kit_imports`,
`kit_two_factor`, `kit_workflows`).

* Collaboration: comments with mentions, followers, tags (with list filtering) and
  per-field change history; notifications only reach users who can read the record.
* Assignments and a "my tasks" page; approval steps reuse assignments.
* Message templates editable per deployment, templated notification e-mail sent by
  the worker, and a realtime notification bell (PostgreSQL NOTIFY on commit, SSE via
  @adonisjs/transmit).
* Outgoing webhooks signed with HMAC-SHA256, retried with backoff, HTTPS-only and
  private-address safe, with a delivery log.
* Personal API tokens (read or read-write) for a bearer-only `/api/v1` resource API
  and a generated OpenAPI 3.1 document.
* CSV import batches with column mapping, processed by the worker with per-row
  errors (XLSX is GAP-006).
* Generic RTL record printing with optional Gotenberg PDF conversion.
* TOTP two-factor authentication with single-use recovery codes. It has not had an
  independent human security review; the owner deferred it to 2.0 (ADR 027, see
  docs/security/two-factor-asvs-review.md).
* Document lifecycle: amend-by-copy for cancelled documents.
* Workflows: versioned `defineWorkflow` definitions compiled to XState 5, a durable
  engine with row locks, six step types, bounded retries, an approvals inbox, a
  record workflow panel and a failed-runs screen.
* Agent: generated capability catalog (`adula:capabilities`), idea-review reading it,
  and the module, security, schema, UI and performance reviewer skills.
* Release: public API contract report (`pnpm check:api`), a genuine upgrade test from
  a version published on npm (`pnpm test:upgrade --published=<version>`), and a
  Performance workflow measuring the compiled build with k6 on a GitHub runner.

## 0.2.0-alpha.4 — 2026-09-24

* Login: the per-address limit is 100 attempts per minute (configurable with
  `LOGIN_ADDRESS_LIMIT`) so offices behind one address can sign in together;
  per-account lockout is unchanged.
* CI: checkout v7, setup-node v7 (no package cache in release jobs),
  upload-artifact v7, download-artifact v8 (digest mismatches fail),
  pnpm/action-setup v6, all pinned by commit SHA.
* Local k6 budgets still fail (list p95 1140 ms, save p95 1060 ms); this alpha
  accepts no phase.
* Security: e-mail is a case-insensitive identity (additive migration with a unique
  `lower(email)` index); OAuth links only to accounts whose e-mail ownership was proven
  (invitation, mailed recovery or a verified provider); a pending invitation reserves
  its address against self-signup; per-account lockout of failed logins (cleared by
  recovery), a per-address login limit and a password-change limit; nonce-based CSP;
  no-referrer/no-store on recovery pages; OAuth redirects drop the query string; pages
  and activity records carry opaque session handles instead of session ids; passwords
  up to 64 characters; minimal public `/health`.
* Kit: validator-added fields are authorized like submitted ones; saved views may only
  query fields their author may query, list the user's own views first and cap shared
  views; attachment fields accept `accept`/`maxSize` with a default document/image
  allowlist, unbound uploads are capped per user and pruned daily
  (`adula:uploads:prune`); impersonated writes record the administrator and
  administrators cannot impersonate administrators; record history shows display names,
  not e-mails; `adula:gaps report` is registered.
* Performance: only the first list page runs the planner estimate; the database pool
  size is configurable with `DB_POOL_MAX` (default 20).
* Supply chain and hygiene: GitHub Actions pinned by commit SHA with Dependabot, npm
  pinned in the publish job, generated `.env.example` without local hosts, users or
  addresses; removed unused dependencies (zod, @hookform/resolvers, @casl/react,
  @casl/ability in the reference app, @ucast/sql), the obsolete probe and PowerShell
  wrapper; reconciled stale publication statements in the docs.

## 0.2.0-alpha.3 — 2026-09-23

* Prefer successful direct `docker version` and `docker compose version` probes;
  use default-distribution WSL Docker only after direct Docker fails on Windows.
* Pin the chosen backend through installation and generated development, tests,
  Ace, service start and service stop commands; never switch daemons on failure.
* Keep WSL alive only on its fallback path, including migrations and tests.
  Direct Docker never starts a WSL session.
* Preserve matching kit/UI/creator versions on alpha without claiming stable acceptance.

## 0.2.0-alpha.2 — 2026-09-23

* Validate the supplied project directory before collecting company details.
* Check Docker Compose and engine availability before prompts or project writes,
  with Windows/WSL guidance and the existing PostgreSQL/Redis alternative.
* Reuse Docker in the default WSL distribution from Windows automatically; ask
  before installing missing Docker Desktop with winget in interactive setup.
  Declining offers existing services or cancellation; unattended mode never installs.
* Clarify that company display names may retain uppercase letters and that
  preflight failures do not necessarily leave files or databases behind.
* Keep matching kit/UI/creator versions on alpha; no stable acceptance is claimed.

## 0.2.0-alpha.1 — release candidate preparation, 2026-09-22

* Prepare the owner-authorized experimental alpha distribution and one-command
  creator; keep next/latest and incomplete 1.0 acceptance explicitly blocked.
* Select local production-mode Docker staging and framework-only delivery (ADR 024).
* Correct the source/provenance destination to adulash/adula-kit.
* Include managed diagnostic files in the production image so initial installation
  and doctor can verify the same UI and agent assets as the source checkout.
* Use PostgreSQL 17 backup/restore clients in CI; the first remote run exposed the
  runner's incompatible default PostgreSQL 16 client.

## 0.2.0 — unreleased

* Add @adula/create-app for one-command creation from an empty folder: AdonisJS, application screens, kit/UI, managed design skill, company identity, isolated PostgreSQL/Redis, fresh migrations, administrator setup and verified assets. Keep registry availability pending publication and host/external-service prerequisites explicit.

* Keep the complete 1.0 acceptance scope; prepare evidence-gated manual npm publication with provenance and the exact independently tested archives.
* Consolidate installation/development/release documentation, align package metadata and licenses, and record the reserved @adula scope.
* Remove educational customers/orders/tasks modules from normal application operation; retain their migrations, listeners and page overrides only as isolated test fixtures, without dropping existing data.

* Ship a business-focused frontend-design skill and route UI work to it through managed agent rules. Request company identity at kickoff and preserve project-owned branding notes across installation.
* Use shadcn components as the agent default, with Dialog for all forms and record details unless the user requests another presentation.
* Add the copied ResourceSurface, use it for generic resource forms/details and the reference order form, and use shadcn Select for lookup and organizational fields. Preserve the explicit page option.
* Verify both managed skills in doctor and test skill repair, identity preservation and modal interaction.

### Foundation carried into 0.2.0

* Establish the pnpm workspace on the official AdonisJS 7 starters.
* Add the resource registry, CASL authorization with PostgreSQL parity tests, organizational scope and field contracts.
* Add transactional JSON resource CRUD, version conflicts, sequences, soft deletion and outbox/listener deduplication.
* Add the reference modules, generator, core bootstrap and diagnostic commands.
* Add local PostgreSQL helpers, CI and unverified deployment/backup assets.
* Wire Redis-backed actor caching, adonis-jobs event delivery, a single scheduler, heartbeat checks and backup failure notifications. Verify actual queue redelivery against PostgreSQL and Redis on Node 24.
* Add independent-consumer configuration, migration discovery, copied HTTP contract harness, repeatable installation and managed agent hashes.
* Add reference module scaffolding/removal with archival and dependency checks.
* Add authorized selected-column projection, estimated counts, packed field rules and editor metadata.
* Add the 25-component Arabic/RTL UI registry, customization protection and update previews; build a hand-designed Arabic order list and form.
* Reconcile inline inserts, updates and explicit soft deletes in one transaction, protect submitted parents and add versioning to reference order lines through an additive migration.
* Verify real browser create/edit/search/mobile behavior and both packed packages in an independent application.
* Add schema-aware money/date/timestamp authorization, Unicode text ordering, calendar-preserving DATE conversion and normalized scalar/JSON write contracts.
* Add the optional MCP resource adapter with authenticated HTTP, CSRF, field/scope and mutation tests.
* Persist submission envelopes atomically with their corresponding outbox events and check migration inventory in doctor.
* Restrict Tailwind source discovery to consumer-owned frontend files, fixing excessive memory use in an independent nested consumer build.
* Generate explicit HTTP fixtures that verify real record isolation, mapped storage, normalized fields, uniqueness, conflicts and soft deletion; guard kit tests with PostgreSQL 17 and a dedicated test database.
* Exercise all field kinds in a PostgreSQL service fixture and reject sparse JSON arrays before storage can change their meaning.
* Diagnose local upload volume and conservatively identify project pages to review after copied UI changes.
* Make packed-consumer installation verification portable through Node with an immutable official starter revision and isolated database environment.
* Accept the official Drive and limiter adapters under a recorded freshness exception, and configure Drive, attachments, limiter, Ally and SMTP mail on private disks and optional credentials.
* Store attachments in a kit table with disk-relative paths, enforce uploader and organizational ownership inside the write transaction, and serve downloads only through the record's own view policy.
* Move files between disks with `adula:storage:migrate`, resumable and non-destructive, and prove a restored record still opens its attachment with `backup:restore-test` on a monthly schedule.
* Complete the authentication lifecycle: password recovery by mail, revocable tracked sessions, disabled accounts, optional Ally providers, rate limits and auth activity.
* Add the fixed core administration screens — users, the roles and rules matrix with a validated condition editor, the movable organizational tree, activity, jobs and health, settings, notifications, sessions — with impersonation visible in every layout.
* Add a route scan that refuses anonymous and unauthorized clients across every registered route.
* Complete the generated interface: every field control, belongsTo autocomplete, inline rows, URL-driven sort, filters and search, virtualization above 200 rows, CSV export, deferred activity and children, and the page override rule.
* Report the field's accessible name without its required marker, and submit the whole form on update so resource validators see a complete document.
* Add `adula:gaps report` and a k6 workload script carrying the plan's performance budget.

See the implementation status and gaps for incomplete plan requirements. This is not a 1.0 release.
