# Implementation status — 2026-09-23

The approved v4 plan is preserved as a historical baseline; [ADR 021](decisions/021-optional-oauth.md) records the owner-approved exclusion of OAuth from base release requirements. The kit/UI/creator packages are published as **experimental 0.2.0-alpha.3** on the `alpha` tag (`latest` still names 0.2.0-alpha.1), not an accepted 1.0 kit. Publication does not prove an independently upgraded, restored and production-operated release.

The repository is public and main is protected by required PRs and passing CI. PRs 1–3 were merged after success. All three npm packages have signed provenance and configured GitHub trusted publishers. Local Docker staging is running. The owner approved retaining `latest` alongside `alpha` for this experimental version; `next` remains absent. See [ADR 024](decisions/024-framework-alpha-and-local-staging.md) and [dated publication evidence](evidence/alpha-publication-2026-09-23.json). No phase acceptance is inferred. The sections below retain the earlier dated implementation history.

## Audit hardening — 2026-09-23

A repository audit (security, plan conformance, bloat) led to the changes listed under
"Unreleased" in the CHANGELOG. Security findings from that audit that are fixed and
covered by new tests: account pre-hijacking through unverified self-signup plus OAuth
e-mail linking, case-sensitive e-mail identity, missing per-account/per-address login
limits, disabled CSP, raw session ids in pages and activity, validator-added fields
bypassing field authorization, unrestricted shared saved-view queries, unrestricted and
never-pruned uploads, impersonated writes attributed only to the target user,
e-mail exposure in record history and backup details on the public health probe.
Performance changes (first-page-only estimate, configurable pool) are not a claim that
the phase 2 budget passes; the k6 budget must be re-measured. Not changed: scrypt cost
(kept at the framework default pending a login-latency benchmark) and a creator
lockfile (needs release-pipeline support). Impersonation changes need the human review
required by the managed AGENTS rule 11.

## Creator prerequisites — 0.2.0-alpha.2 preparation, 2026-09-23

The first external alpha trial exposed delayed directory validation and an
unhelpful Docker spawn error in Windows PowerShell. Supplied destinations are
now checked before company prompts, and Docker/Compose preflight runs before
prompts, package setup or project writes. Diagnostics distinguish unavailable
Compose from an unreachable engine and explain Windows/WSL execution and the
existing PostgreSQL 17 plus Redis alternative. Company display names remain
independent of lowercase project directory names. Failure output no longer
asserts that files/databases were created when preflight stopped installation.

Regression coverage includes early invalid-name rejection, both Docker failure
paths, successful preflight ordering, and a real CLI child process with Docker
absent from PATH that must leave the target nonexistent. This is a local source
correction; npm 0.2.0-alpha.1 has not been replaced or republished.

The owner expanded the correction to operational Windows support: reuse native
Docker or Docker in the default WSL distribution, and ask before installing
missing Docker Desktop with winget. Declining offers an existing PostgreSQL/Redis
profile or cancellation. Unattended mode never installs host software. A stopped
engine can be retried; installer/restart failures stop before project creation.
Consent, refusal, cancellation, restart, engine retry and WSL selection have
regression coverage. Windows installer execution itself is not claimed as tested
on a clean machine; its consent flow is tested with an injected executor.

Local verification passed: build, typecheck, lint, boundaries, 132 kit tests,
4 UI tests and 17 creator tests (one Unix-only test skipped on Windows). The
reference suite passed on retry using GNU tar on PATH and permission to launch
Playwright; the first run selected Windows BSD tar and could not launch the
browser in the sandbox. PostgreSQL 17 used the dedicated test database. Logs:
`.work/creator-preflight-*.log`. No archive or publication acceptance is claimed.

## Direct Docker priority — 0.2.0-alpha.3, 2026-09-23

The owner requested publication of the creator fix and explicitly excluded the
existing Dental Gate application from this release's verification. Discovery now
requires successful direct `docker version` and `docker compose version` probes,
then tries WSL only on Windows after direct failure. The selected backend is
persisted in generated projects and reused for development, tests, Ace commands,
service startup and shutdown. Later errors never select another daemon. Only the
WSL fallback uses the foreground session helper. Isolated creator acceptance
now crosses the WSL idle window before real PostgreSQL migrations and Redis PING.
Direct Docker is not installed in this Windows session; direct command routing
has regression coverage and the Linux CI creator acceptance uses real direct Docker.
Direct-generated projects do not copy or load the WSL session helper. Local
build, typecheck, lint, boundaries, release tests and the full PostgreSQL/browser
suite passed (`.work/alpha3-*.log`). The creator suite passed 35 tests with one
Unix-only test skipped on Windows. Archive consumer and remote release checks
remain distinct required publication gates.

## WSL creator lifetime correction — 2026-09-23 (prior recovery)

The Dental Gate alpha.2 installation reached database creation, then lost both
PostgreSQL and Redis before migrations. The default WSL distribution was exiting
after its last foreground command; both project containers were found stopped.
The creator now owns a foreground WSL session through an stdin pipe for its
entire installation and releases it in `finally`. Parent exit also closes the
pipe. Native Docker and existing-services installations do not start this helper.

Generated WSL consumers receive project-owned development scripts: `npm run dev`
starts healthy Compose services and holds WSL while Adonis runs; `npm run services`
keeps services attached for standalone commands/tests. No global WSL setting or
installed kit internals are modified. Microsoft documents that systemd services
do not keep WSL alive: https://learn.microsoft.com/en-us/windows/wsl/systemd.

The existing Dental Gate consumer was recovered with its original volumes and
credentials. Migrations, administrator/UI setup, doctor, typecheck, both starter
tests and production build passed. Its generated development command served the
login page with HTTP 200 after the idle window. Regression tests cover native
no-op behavior, WSL startup failure, session survival across child commands and
EOF cleanup. This source correction has not been published to npm and accepts no
additional release or phase gate.

Repository validation passed: `pnpm build`, `pnpm typecheck`, `pnpm test`,
`pnpm lint`, and `pnpm check:boundaries` (`.work/wsl-fix-*.log`). Tests used
PostgreSQL 17 and the dedicated test database; the initial run failed while that
local cluster was stopped, then passed after it was started. The creator suite
passed 28 tests with its existing Unix-only test skipped on Windows.

## Historical checkpoint — 2026-09-21

The [confirmed-achievements ledger](confirmed-achievements.md) separates demonstrated component outcomes from the still-open phase gates. The 2026-09-21 [source review](evidence/implementation-review-2026-09-21.json) reran all six local validation commands: 282 tests and five release guards passed on PostgreSQL 17.6.

- The owner declined OAuth setup. No OAuth application, Google project or client secret was created; Google/GitHub authentication is not claimed verified. Local email/password login and mail recovery remain available.
- Completed: initial setup center, administrator safety/UI preferences, real mail receipt/recovery, S3 setup roundtrip, real offsite database restore, isolated local-attachment restore, and the source-S3 attachment/migration/offsite recovery acceptance harness. Detailed dated evidence is linked below.
- Final verification after adding the S3 harness passed 282 local tests plus build/types/lint/boundaries and five release guards. The separate real-provider source-S3 run passed both its original-database and restored-database HTTP phases. These counts remain separate from remote CI and phase acceptance.
- Remaining: natural daily/monthly scheduling, staging/performance/production acceptance, the rest of the approved 1.0 scope, and verified npm publisher configuration. Source-S3 command integration, COMPLETE ordering and scheduler volume configuration were repaired on 2026-09-22; see the dated section below. Local npm authentication returned ENEEDAUTH; GitHub OIDC remains unverified.
- Current version: 0.2.0 unreleased; branch: codex/core-user-invitations. No merge, push or npm publication occurred.

## Implemented and exercised locally

### Release acceptance preparation — 2026-09-22

On `codex/release-acceptance-preparation`, the owner confirmed local-only work.
The [execution packet](release-acceptance-runbook.md) specifies the four remaining
acceptance tracks and evidence needed without inventing a staging destination,
remote configuration or human approval. `pnpm release:status` reports both channel
guards and every pending phase, with a JSON mode and blocked exit status.

The k6 workload now requires an explicit independent consumer fixture, distinct
accounts and persistent per-VU cookie jars; it validates both belongsTo preloads
and created records, aborts functional failures and samples only successful latency.
It has not been run with k6: realistic seed/consumer, staging and cached Ability
measurement remain outstanding. Harness contract tests do not prove authorization
or throughput. The existing PostgreSQL authorization suite remains unchanged.

`pnpm test:upgrade` refuses ambiguous invocation. The existing regression is available
as `pnpm test:upgrade:synthetic`; it rejects `ADULA_PREVIOUS_VERSION` before mutations
and explicitly reports that its predecessor is synthesized. No genuine upgrade is
claimed or new version selected.

Build, typecheck, lint, boundaries and **297 project tests** passed on PostgreSQL
17.6/Node 24.21.0; **13 release/tooling tests** passed. Package metadata checks passed
and both publication guards correctly rejected 0.2.0. The development doctor's two
previously documented failures (installed version and removed educational migration
paths) remain; no data/history was rewritten. See [dated evidence](evidence/release-acceptance-preparation-2026-09-22.json).
No archives, independent application, remote configuration, human review or phase
acceptance were produced by this preparation. All readiness phases remain pending.

### Core user invitations (ADR 022, 2026-09-21)

- Branch: `codex/core-user-invitations`. The kit now owns the additive invitation migration and `UserInvitations` service. Standalone creator templates include the controller, Arabic mail, permission-aware navigation and project-owned invitation/acceptance Dialogs on first installation.
- Administrators inherit invitation authority; a deployment-wide `core.users/invite` grant delegates only invitations. Explicit denies and organizationally scoped roles are enforced against real PostgreSQL authorization rows. No role, organization, password or replacement email is accepted from the invitation request beyond the validated recipient/name.
- Only token digests are stored. Links expire after 24 hours, resends invalidate older links, failures are retryable, and concurrent acceptance creates exactly one account. Account creation, token consumption and audit commit together. Passwords use the configured Adonis hasher, are never emailed, and invitations grant no automatic roles.
- The browser tests cover duplicate feedback with preserved input, successful SMTP dispatch, a 390px modal, keyboard dismissal confirmation, Arabic password confirmation errors, acceptance, replay rejection and actual login. Token pages use no-referrer/no-store; validation redirects explicitly to the token route rather than relying on the suppressed Referer header. The mobile invitation and desktop validation screenshots were inspected.
- The implementation workspace run passed **288 tests**: 130 kit, 4 UI, 142 reference HTTP/browser and 12 creator safety tests. Build, typecheck, lint, boundaries, five release guards, 15 independent packed-consumer tests and archive checks passed. SMTP delivery was exercised against a loopback server, not an external recipient. Evidence: [user invitations](evidence/user-invitations-2026-09-21.json).
- The E2E follow-up passed all **23 browser tests**, including two new continuous scenarios: real login as administrator or delegated inviter, invitation delivery over loopback SMTP, UI logout, acceptance through the emailed link, replay rejection, recipient login and forbidden invitation access. The test exposed and fixed sidebar overflow that made the administrator account menu unreachable at 1280x720. These scenarios use real PostgreSQL authorization and SMTP transport, without `loginAs` or fake mail.
- A fresh application created from the local creator archive passed both starter HTTP tests, including invitation delivery/acceptance and denial of invitation authority to the new account, plus lint and real administrator browser login/setup checks. A final audit review separated pending invitation IDs into `core.user_invitations` activity records; the package was rebuilt and all four invitation HTTP tests and affected lint checks passed again. No phase or public-release gate was promoted.
- The existing development database's `adula:doctor` still reports an out-of-sync installed kit version and legacy migration paths for the educational modules removed under ADR 017. Its history/data were preserved and the modules were not re-enabled. The clean independent consumer's doctor passes; these development-database findings are not a failure of the new installation schema.

### Operational backup and attachment recovery — 2026-09-22

The subsequent [npm operational acceptance review](npm-acceptance-review-2026-09-22.md)
re-ran the local validation gates on `codex/npm-operational-acceptance` and confirmed
that the Docker/staging/schedule, performance, human review and genuine upgrade
gates remain open. It identified invalid assumptions in the existing k6 workload
and the synthetic predecessor in the upgrade harness. Detailed run results and
limitations are in [the review evidence](evidence/npm-acceptance-review-2026-09-22.json).
No phase was promoted and neither npm channel was accepted.

- Replaced the local-only daily backup body with the shipped `backup:create` command. A shared PostgreSQL MVCC snapshot supplies the dump and complete attachment inventory; Drive reads each file from its original disk, and a versioned manifest records size and SHA-256. Missing files abort the backup.
- Every offsite artifact is downloaded and hash-verified before `COMPLETE` is published. Completed prefixes cannot be overwritten; failed upload/read/checksum/marker cases do not publish success. The scheduler now mounts `/backups` read-only while retaining writable local uploads.
- `backup:restore-test` validates every manifest entry against the temporary restored database, restores and reads temporary keys on each disk, and removes them. `backup:verify-snapshot` validates archives before actual database recovery; `backup:restore-files --apply` restores original keys after inventory validation and verifies their bytes. The operational restore shell invokes these commands.
- Direct real-S3 command acceptance passed: three files were archived, originals deleted, missing-source backup rejected without either completion marker, monthly drill completed without recreating original keys, and actual file recovery restored byte-exact authorized HTTP downloads. Both isolated databases and original synthetic objects were removed. Small offsite test snapshots remain under their unique evidence prefixes, consistent with the no-delete backup policy.
- Final verification passed build, typecheck, lint, boundaries, 295 local tests (130 kit, 148 reference, four calendar, 13 creator), five release guards and shell syntax. The separate S3 command exercise passed positive and negative cases.
- See [operational backup evidence](evidence/operational-backup-2026-09-22.json) and [ADR 023](decisions/023-operational-attachment-recovery.md). Earlier dated local-only limitations below are historical and superseded by this section. Docker is available inside Ubuntu WSL. Local container permissions and backup/recovery passed in the follow-up below; natural daily/monthly scheduling and staging recovery remain open. No phase is newly accepted.

### Docker operational verification — 2026-09-22

- Built the production image with compiled workspace packages and production dependencies; the build rejects dangling kit/UI links and imports both packages before completion.
- PostgreSQL 17 migrations and web/worker/scheduler health checks passed. The scheduler runs as node with read-only /backups and writable uploads.
- The backup service startup captured local and real S3 files. Independent S3 downloads verified all artifact hashes and COMPLETE. The monthly command was invoked manually inside the scheduler; it verified two files in a temporary database with --allow-empty because the synthetic attachments are unbound.
- After deleting both originals and mutating a test user, the operational restore shell recovered the database and both original keys. SHA-256 checks and the user value matched; reconciliation and restarted service health passed. Synthetic source objects and all isolated Compose volumes were removed; five offsite objects remain under a unique test prefix.
- Evidence: [Docker acceptance](evidence/docker-backup-2026-09-22.json). Bound-record HTTP authorization is covered by the earlier source-S3 exercise, not this Docker fixture. Natural timer firing, Caddy/TLS, creator Docker provisioning and staging/production recovery are not claimed.

### Source-S3 attachments, migration and offsite recovery — 2026-09-21

- Added the explicit `pnpm test:s3 --credentials-file=<local-env-file>` harness. It creates two dedicated PostgreSQL 17 test databases, uses an isolated Redis test database and HTTP port, and never enables educational modules in normal application operation. The ordinary test suite does not use external credentials or contact S3.
- Three synthetic files (58 bytes of Arabic text, 64 KiB and 1 MiB) were uploaded through the real application attachment route with `DRIVE_DISK=s3`, bound to records, and downloaded with matching SHA-256 hashes. Unbound ownership, organization scope, field denial and anonymous-access checks passed. Migration from S3 to the filesystem and back passed without a storage-service code change, including dry-run and repeat behavior.
- Snapshot file bytes were downloaded from source S3, archived with a database dump and manifest, uploaded to the separate offsite backup configuration, downloaded again and checksum-verified. The original source objects were deleted and 404 absence verified. A second database was restored; the downloaded archive repopulated the original synthetic S3 keys. A fresh application process using the restored database verified record/attachment bindings, exact HTTP download hashes and retained authorization restrictions.
- All three source objects and both temporary databases were removed. Five offsite snapshot objects remain as evidence under the unique acceptance prefix because backup IAM intentionally forbids deletion. The first run passed all recovery checks but failed its attempted backup cleanup; the final harness retains backup evidence explicitly and passed with no cleanup errors. No IAM permissions were changed.
- This establishes an isolated real-provider recovery exercise. The container shell and monthly restore command still handle local uploads only; their source-S3 integration, completion-marker ordering, scheduler volume and actual scheduled operation remain open. See [dated evidence](evidence/source-s3-acceptance-2026-09-21.json) and [execution instructions](development.md#explicit-source-s3-acceptance).

### External mail and live runtime verification — 2026-09-21

- The generated consumer sent a real SMTP test through Resend using a verified sending domain. The owner confirmed receipt in Gmail, and the confirmation persisted after page reload. The initial sandbox-sender attempt was rejected by Resend and remained failed; it was not counted as successful delivery.
- The password recovery flow sent a separate message. The owner completed password reset and successfully logged in afterward; server audit events verify that sequence without recording the reset URL, password or API key in this repository.
- One worker and one scheduler were started for the generated consumer. Both heartbeats became healthy; its PostgreSQL/Redis connectivity and local storage roundtrip passed from the setup UI. Three real PostgreSQL/Redis runtime tests passed in the isolated reference test database, including duplicate queue delivery and restore reconciliation.
- S3 and backup credentials were subsequently supplied in the generated consumer. After the owner attached bucket-scoped IAM permissions, the real S3 setup write/read/compare/delete probe passed on 2026-09-21. The probe now supplies the known stream length required by the installed AWS SDK; ACL requests remain disabled. This establishes the setup probe only, not record-bound S3 attachment or offsite restore acceptance. See [S3 evidence](evidence/s3-setup-2026-09-21.json).

### Offsite database snapshot and isolated restore — 2026-09-21

- Uploaded a real consumer database dump, local uploads archive, checksums and completion marker to the configured private backup bucket; downloaded every object again and compared hashes. The existing restore command passed with explicit `--allow-empty`. A separate isolated restore verified account records, roles and settings, then removed its temporary database.
- The setup page reports a recent successful offsite inspection. It still correctly withholds record-and-attachment acceptance for that consumer, which has no attachment records. This database-only run did not verify source-S3 recovery; the later isolated source-S3 exercise is recorded above. Scheduled backup execution and production supervision remain unverified. This one-time run used the installed AWS SDK and kit inspection service; it does not validate the container/AWS CLI path. See [dated evidence](evidence/offsite-database-restore-2026-09-21.json).

### Offsite attachment fixture drill — 2026-09-21

- Two dedicated PostgreSQL restore tests passed, including missing-file and corrupted-checksum rejection. A separate snapshot of the isolated reference test database and its local attachment archive was uploaded to an acceptance-test prefix in S3, downloaded, and restored with the existing command without `--allow-empty`. The bound record and 74-byte attachment were verified, exact file bytes matched, and temporary restore databases were removed. Normal application modules and data were untouched.
- Daily backup shell syntax passed, but its Docker/AWS CLI runtime remains unavailable here. The container script writes `COMPLETE` after uploading, so remote completion-marker handling still needs correction and verification. Source S3 objects are not covered by its local uploads archive. See [evidence](evidence/offsite-attachment-restore-2026-09-21.json).

### Initial setup and administrator mail receipt (ADR 020)

- A project-owned administrator setup center reviews installed identity, links UI preferences, tests internal notifications through the inbox/read flow, checks storage with a private write/read/delete probe, and checks PostgreSQL/Redis connectivity. Worker/scheduler heartbeats, backup inspection/restore results and optional OAuth configuration are separate signals.
- Mail tests use the current administrator's stored email. SMTP acceptance leaves the attempt pending until that administrator explicitly reports receipt or non-receipt. Attempts have cooldowns, stale-confirmation checks, configuration fingerprints and protected audited state. Failures expose no raw transport credentials. A real loopback SMTP sink verifies the transport locally; the separately recorded 2026-09-21 acceptance adds actual external inbox delivery and owner confirmation.
- The generated application includes the setup page and guide. Production builds retain project identity metadata so a build does not invalidate identity approval. Navigation uses the persistent Inertia workspace. Operational evidence cannot be overwritten from generic settings.
- Password recovery preserves its generic response on SMTP failure, revokes only the failed attempt's token and audits failure without transport secrets. Worker-test cleanup handles an already signaled process without waiting for a second exit event.
- The final serial full suite passed 282 tests (130 kit, 136 reference, 12 creator, 4 calendar), including browser receipt/identity workflows, PostgreSQL races, authorization, and a real local SMTP conversation. Five release-guard tests, build, types, lint and boundaries passed. Packed consumer and from-zero creator acceptance passed, including browser storage/notification checks and production identity preservation. See [dated evidence](evidence/initial-setup-2026-09-20.json). This work is isolated on `codex/initial-setup-readiness`; no merge or external release has occurred.

### Administrator safety and interface preferences (ADR 019)

- Transactional guards preserve the last active unrestricted administrator and prevent administrators from revoking their own administration access. Repeated installation repairs a missing bootstrap grant without removing custom deny rules. Permission changes and destructive actions require clear confirmation and report server rejections.
- System UI preferences offer Gregorian, Umm al-Qura Hijri, or both calendars. Inputs normalize to Gregorian ISO storage; business tables, detail views and filters use the selected presentation. View dialogs dismiss outside; edit dialogs confirm dismissal. The persistent workspace uses short, reduced-motion-aware transitions and labels operations as `تشغيل النظام`.
- The installer now uses English prompts and six real progress stages, with color and animation only in interactive terminals. Application UI remains Arabic. Project-owned components and company identity are preserved during updates.
- The full local suite passed 269 tests (122 kit, 131 reference, 12 creator, 4 calendar), including PostgreSQL authorization races and browser workflows. The independent packed consumer passed, including repeated repair of an intentionally removed bootstrap grant in its isolated test database. These checks do not accept any outstanding 1.0 phase.
- Final build, typecheck, lint and archive checks passed. The packed creator completed from-zero installation, overwrite rejection, application tests/lint and real administrator browser login. The existing Dental_Gate consumer was updated with preserved identity/business data; administrator login and all three calendar choices were verified in its live settings page. See `docs/evidence/admin-ui-2026-09-20.json`.

### Standalone application creation (ADR 018)

- `@adula/create-app` starts from an empty directory and installs AdonisJS, the kit, authentication/admin screens, project-owned shadcn UI and managed business-design skills. The scoped npm command will be `npm create @adula/app@latest my-app` after publication; local tarballs exercise the same executable today.
- The wizard requests company identity and administrator email. Supplied company naming/color/logo is applied immediately; missing identity stays pending in `docs/design-identity.md`. Credentials are random and private. Existing application files and database names are never overwritten.
- Docker Compose provisions PostgreSQL 17/Redis 7 by default; the existing-services path creates fresh development/test databases. Test ports, application keys, cache/queue/limiter namespaces and database names are isolated. Node/npm and Docker in Docker mode remain host prerequisites. SMTP/OAuth/S3/production destinations still require actual configuration.
- The packed-creator consumer verifies installation through npm without a global pnpm, real migrations and administrator authorization, company identity, managed skills/UI, types/build/lint, HTTP isolation and actual browser login to administration. Nine creator safety tests cover the bundled package manager, path/environment/secret handling and interrupted Redis preflight. Docker execution is configured in CI but was not run locally because Docker is unavailable.
- Release checks and the workflow now cover all three packages. CI reuses the same archives across consumer and creator checks; no package has been published and no 1.0 gate is newly marked accepted.

### Release preparation and removal of educational modules (ADR 017)

- The owner reserved the `@adula` npm scope, authorized a local commit, and explicitly selected complete 1.0 acceptance. Workspace/package/reference versions are aligned at **0.2.0, unreleased**; they have not been promoted to stable.
- Customers/orders/tasks, their migrations, listeners and page overrides now live under `tests/fixtures` and load only in test mode against a dedicated `_test` database. Normal registration, navigation and seeding contain no educational modules. Existing development data was preserved; tracked migration bodies were verified unchanged. Tests prove normal-runtime isolation, production frontend exclusion and the absence of hardcoded home links, while preserving the existing authorization/CRUD/attachment/queue/browser tests.
- Canonical guides cover installation, development, 1.0 acceptance and release preparation. `adula:install` initializes an already configured consumer; ADR 018 adds the standalone creator around it. The capability command reads its shipped catalog instead of a separate stale version string.
- Package metadata now identifies the real GitHub destination; both packages retain MIT licensing and UI upstream attribution. Packaging checks verify exports, required files, private/test-file exclusion, registry versions and SHA-256 checksums.
- Manual `release.yml` reuses CI at the tagged commit and publishes the same independently tested archives through a protected `npm` environment with OIDC/provenance. Its stable guard intentionally rejects the current version. All phase entries in `release-readiness.json` remain pending; workflow syntax/local guards were checked, but remote CI and publication were not run.

### Business UI defaults (ADR 016, 2026-09-19)

- Managed agent rules require the bundled `adula-frontend-design` skill for UI work. It targets daily business workflows, readable tables, consistent actions, Arabic RTL, validation, permissions and restrained visual tokens.
- At project kickoff the agent requests missing company name, logo, colors, fonts and brand guidelines, reuses what was already supplied, and records sources and unresolved choices in project-owned `docs/design-identity.md`. Pending branding permits independent work and provisional neutral previews, not invented approval.
- Agent UI defaults are project-owned shadcn primitives and Dialog for forms and record details, with explicit user-requested exceptions. Installation ships both idea-review and frontend-design skills; doctor detects missing or changed skills. Tests prove identity notes and unrelated project skills survive repeated installation.
- The new copied `ResourceSurface` is consumed by generic form/show pages and the reference order form. It provides direct route access, RTL, bounded scrolling, focus containment, Escape/close dismissal and an explicit `presentation="page"` option. Lookup and organization fields use shadcn Select. Existing unrelated custom screens are not automatically rewritten.
- Browser coverage exercises CRUD, nested controls, all field kinds, direct detail URLs, mobile margins, keyboard focus/dismissal and the explicit page option. The updated desktop/mobile modal screenshots were inspected by the agent; this does not replace the plan's human visual acceptance gate.
- The independent packed consumer installs the current design skill, preserves its company identity and component customization on repeated installation, passes 15 HTTP tests, typechecks and builds production assets. No package was published.

### Earlier foundation

- Official AdonisJS 7 package/React starter foundations; Node 24, pnpm, React 19/Inertia 3, PostgreSQL 17, exact package versions and MIT licensing.
- Resource/module registry, explicit organizational scope, relationship validation, standard columns, immutable schema snapshots, GiST/GIN/partial indexes, keyset pagination and a 100-row cap.
- CASL allow-before-deny rules, SQL/in-memory parity, organizational AND scope, field redaction, writable whitelists, selected-column projection, packed field rules and scoped estimates. Schema-aware money/date/timestamp predicates and Unicode ordering have PostgreSQL parity tests. Invalid storage representations fail before coercion.
- Transactional create/update/soft delete, sequences, version conflicts, draft/submit/cancel, activity and outbox. Inline inserts, versioned updates and explicit deletes are atomic; omitted rows remain unchanged. Parent ownership, organization and submitted-state checks protect direct child routes too.
- Submission persists an event-linked workflow envelope in pending_definition state. This is not the XState engine.
- Organizational subtree moves and database revision triggers; Redis actor-cache invalidation, adonis-jobs delivery, SKIP LOCKED publication and listener deduplication. Real queue redelivery and post-restore queue/cache reconciliation are tested locally.
- Core roles/memberships/settings/lookups/notifications/sequences/activity tables; scheduler/worker heartbeats and backup-object checks.
- Optional @adula/kit/mcp adapter and authenticated, CSRF-protected /mcp endpoint. HTTP tests cover all operation denials, field/scope restrictions, rejected actor override, validation, optimistic conflicts and transactional mutations.
- Independent-consumer configure hook, PostgreSQL/module migration discovery, copied controller/routes/security harness, repeatable install, managed AGENTS/skill hashes and module add/remove with archival/dependency checks.
- Generated HTTP contracts require application-owned fixtures for every form field, verify mapped stored values and normalized inline rows, and exercise scope isolation on reads/writes, central-resource access, field redaction, protected inputs, version conflicts, unique constraints and soft deletion. All four reference resources consume the helper.
- An all-field PostgreSQL service fixture covers all 12 field kinds, custom columns, required/nullable values, scalar JSON roots, timestamps, projection versus serialization. Sparse JavaScript arrays are rejected before JSON serialization can replace holes with null.

### Storage and attachments (ADR 013)

- A kit `attachments` table records disk, disk-relative path, names, size, mime type, the rehydration payload, uploader, organization and the binding (resource, record, field). Resource attachment columns reference it with RESTRICT.
- Ownership is enforced inside the existing write transaction: an attachment must exist, be undeleted, belong to the acting user and be unbound or already bound to the same record and field; a scoped record's attachment must share its organization. Replacing or clearing a binding soft-deletes the previous row, so restores can still find the file.
- Upload (`POST /attachments`) checks the ability to create or update that resource **and** that field plus the field's permission level. Download (`GET /attachments/:id`) authorizes bound files through `ResourceService.show`, so organizational scope, record conditions and field redaction all apply, and confirms the serialized field really references that id; unbound uploads are readable only by their uploader. Every other case answers 404 rather than leaking existence. Files are private on every disk, streamed with `nosniff`, `no-store` and an RFC 5987 disposition that survives Arabic names.
- `adula:storage:migrate <from> <to>` copies live files between Drive disks, verifies size, repoints each row in its own statement so an interrupted run resumes, supports `--dry-run` and never deletes the source. It is tested against a real move between two filesystem disks.
- `backup:restore-test` restores a snapshot's `database.dump` into a temporary database, extracts `uploads.tar.gz`, counts every resource table, opens a record that has a bound attachment, verifies the file exists with the recorded size, writes `settings.backup.lastRestoreTest` and then drops the temporary database. It is scheduled monthly and is tested both for success and for a snapshot whose archive is missing the file.

### Authentication lifecycle

- Password recovery with single-use hashed tokens that expire after an hour, an Arabic mail, an identical answer whether or not the address exists, and revocation of every session of that user on reset.
- A `user_sessions` table with device, address and last-seen tracking; account and administrator session screens; revocation takes effect on the next request because the underlying session row is deleted too. Disabled accounts cannot sign in and are ejected mid-session.
- Ally providers are offered only when both of their credentials are configured; an unconfigured or unknown provider answers 404. The callback requires a verified address, links by address or creates the account, and records the link in `social_accounts`.
- Rate limits on sign-in, sign-up, recovery, OAuth and the authenticated resource and MCP routes, with Arabic messages. Tests use the in-process store so parallel suites never share counters.
- Authentication events (sign-in, failure, sign-out, recovery request and completion, revocation, OAuth sign-in, profile and password changes) are written to the kit activity log.

### Core administration screens (ADR 014)

- Kit services for users, roles and rules, organizational units, activity, settings, notifications and runtime health; every mutation is audited in its own transaction.
- Reference screens for users (roles, organizations, disable, impersonate, revoke sessions), the roles × resources × actions matrix with a condition editor validated by the kit's own condition compiler, the movable organizational tree, activity, jobs and health, settings, notifications and sessions.
- One administration middleware (`manage all`), an impersonation banner mounted in every layout, and operational settings that are readable but not editable.
- A route scan asserts that anonymous clients never reach a protected route, that a user without roles is refused on administration and resource routes, and that the administrator opens every GET route without 403 or 500.

### Generated interface (ADR 015)

- ResourcePage, DataTable, ResourceForm, ResourceField, ResourceValue, ResourceShow and Can cover every field kind: string, text, integer, money with Arabic formatting, boolean, date, datetime, JSON with validation and formatting, attachment upload with replace and clear, belongsTo autocomplete over the authorized options route, lookup, and inline hasMany rows with per-row versions and deletion markers.
- DataTable drives sort, direction, search and filters through the URL, appends keyset pages, virtualizes above 200 rows, exports the loaded rows as UTF-8 CSV and renders row actions through record permissions.
- ResourceShow loads record children and the record's activity as deferred props. The page override rule resolves `inertia/pages/<resource>/{index,form,show}.tsx` at boot; the hand-built order pages continue to win for their modes.
- Updates submit the whole form rather than a partial payload, because the resource validator checks the submitted document and `version` is what protects concurrent edits.

## Verification and limits

The release-preparation baseline on 2026-09-19 uses Node **24.21.0**, PostgreSQL **17.6** on an isolated loopback cluster and Redis **7.0.15**: **115 kit tests, 128 reference HTTP/runtime/browser tests, 15 independent-consumer tests and 5 release-guard tests passed (263 total).** Build, typecheck, test, lint, boundaries, independent consumer and archive checks passed. Production assets also exclude educational pages when built with CI's `NODE_ENV=test`. The production dependency audit reported no known vulnerabilities. Evidence is in [release preparation](evidence/release-preparation-2026-09-19.json); local logs are `.work/release-*.log`. The creator adds nine safety tests, a generated-app HTTP test and an actual administrator browser flow; its evidence is recorded separately in [creator validation](evidence/create-app-2026-09-19.json).

On Windows the restore tests require GNU tar on PATH because BSD tar rejects `--force-local`; archive inspection separately uses relative filenames to avoid GNU tar interpreting drive letters as remote hosts. The consumer's doctor has no failing checks, with expected backup and preserved-customization warnings. The earlier design skill validation remains valid.

The independent official-starter consumer installs both local tarballs, configures twice without overwriting its customized service, generates and migrates a resource, passes its 15 HTTP tests, installs the current registry, rejects overwriting a customized component, previews without changing the component or lock, preserves project AGENTS rules, runs doctor, verifies archived module and test hashes, typechecks and builds production assets. This is not a minor-version upgrade or the medical-assets attachment-restore slice.

RTL screenshots of the generated index, form and show pages on desktop and mobile are written to `.work/screenshots/` by the browser suite. They have not yet been reviewed by a human, which is what the plan's visual review means.

The repaired k6 workload ran locally on 2026-09-22 against the disposable independent consumer: 100000 seeded assets, 50 distinct users, 3 minutes, 5805 successful lists and saves, 11710 checks passed and no HTTP failures. Both latency budgets **failed**: list p95 **504.83ms** (budget <300), save p95 **463.00ms** (budget <200). Cached actor loading plus Ability construction passed the local <5ms check at **1.25ms p95**, with 500 samples and real authorization-revision invalidation. This is one development web process on Windows, not staging. Do not infer production capacity or acceptance from it.

The disposable medical consumer now installs local archives into a separate generated application, owns its customized button and index page, and passes **61 real PostgreSQL HTTP tests**, typecheck, lint, build and doctor (expected backup/customization warnings). A complete snapshot restored into a new database and initially empty upload root; both databases contain **105806 assets** after the load run. Authorized record/file reads, byte-exact download, cross-scope denials and customization hashes passed after restore. Stable desktop/mobile screenshots are available, but human review is pending; inspect the localized date order on the detail view. The owner explicitly waived branding for this temporary test. This proves local installation/recovery, not a published minor-version upgrade. Reproduce with `pnpm test:medical`; see [fixture instructions](../tests/medical-consumer/README.md) and [dated evidence](evidence/medical-consumer-2026-09-22.json).

The creator's generated module marker was corrected after the real consumer exposed incompatibility with `adula:resource`; a regression exercises module generation from the built template. After this change, build/typecheck/lint/boundaries passed, as did **297 repository tests**, **14 release tests**, **15 packed-consumer tests** and the archive check. `test:medical` retains functional recovery results but exits **99** when requested k6 latency thresholds fail.

The earlier SQL-compiler spike and 100,000-row ltree EXPLAIN are recorded in docs/evidence/authorization-probes.json. They are not the k6 workload.

## Remaining acceptance work

Phase 0: remaining creator/deployment container paths, remote CI and branch protection when GitHub is authorized, and the timed feasibility exercise. S3 configuration has passed its real setup probe and the @adula organization is reserved; publisher setup remains unverified.

Phase 1: complete staging, resource contracts and natural scheduled backup operation. Source-S3 integration in shipped backup/restore commands passed direct command acceptance on 2026-09-22. External SMTP receipt/recovery and isolated offsite recovery exercises for both local and source-S3 attachments passed. OAuth is optional under ADR 021.

Phase 2: resolve the measured latency failures and pass the budget on staging, complete human RTL visual review (including localized date order), a genuine minor-version upgrade of the independent slice and council 1. Local customized medical-assets installation and attachment recovery passed; this does not accept the whole phase.

Phases 3–7 remain gated by phase 2 vertical-slice acceptance. Business collaboration, full workflows, reviewer skills, the complete medical-assets consumer, production acceptance and public release are not claimed as implemented.

## External constraints

Historical, 2026-09-22; publication and repository state are superseded by the top of this file.

Docker is available inside Ubuntu WSL and the isolated operational acceptance passed; verified k6 2.3.0 is available locally and the first load run failed latency thresholds. No staging destination/SSH was supplied. S3 and offsite configuration are present; isolated database, local-attachment and source-S3 attachment recovery exercises passed as recorded above. The owner confirmed @adula reservation; the GitHub repository remains private and npm trusted publishing is not configured/verified. The application Compose services and manually invoked backup/recovery path passed local container acceptance. Caddy/TLS, deployment, natural scheduled backup/restore and staging supervision remain unverified. GitHub pushes remain on hold. No application or package has been published.

The development `.env` and `.env.example` now use the valid `DRIVE_DISK=local` value. Optional OAuth credentials in the example are empty, so copying it does not falsely enable a provider. OAuth remains disabled and unverified by owner choice, without blocking the base release; external SMTP receipt and recovery were verified as recorded above.

### Accelerated schedule acceptance — 2026-09-22

After commit f342707, isolated Docker timers produced two complete offsite snapshots and repeatedly restored a bound record and both local/S3 files. Hiding the latest archive caused scheduled failure without advancing the last-success timestamp; restoring it allowed automatic recovery. The commands were launched by the scheduler, without --allow-empty. Intervals were shortened only in the test container.

That run exposed two monitoring defects: an ignored BACKUP_S3_PREFIX and an omitted COMPLETE requirement. Both were subsequently repaired and verified; see [monitor repair](evidence/backup-monitor-repair-2026-09-22.json). See [schedule evidence](evidence/scheduled-backup-2026-09-22.json). Natural calendar operation and staging remain pending.
