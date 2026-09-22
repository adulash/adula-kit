# 1.0 acceptance

The owner explicitly selected the **complete 1.0 plan**, not a stable label for 0.2.0. All gates in the [approved plan](../adula-kit-plan.md) remain applicable, with educational-module removal recorded in [ADR 017](decisions/017-test-only-examples-and-release-gates.md) and optional OAuth excluded from base release requirements by [ADR 021](decisions/021-optional-oauth.md).

| Phase | Required acceptance evidence | Current boundary |
|---|---|---|
| 0 — Foundation | Container/Compose verification, S3, GitHub CI/branch protection, npm scope, timed feasibility exercise | Local runtime works; scope reserved. Local application/backup containers passed; remote and remaining deployment acceptance pending. |
| 1 — Core | Authorized CRUD/field contracts, route scan, real SMTP delivery/recovery, staging, offsite database/upload snapshot and restored record with attachment | External SMTP and isolated offsite local/source-S3 attachment recovery passed; shipped backup/restore command integration also passed direct S3 acceptance; local Docker backup/recovery passed; natural scheduling, staging and production acceptance remain pending. |
| 2 — Interface | Human RTL review, 100,000-row/50-user k6 budget, independent medical-assets slice with real minor upgrade and attachment restore, council 1 ADR | Local UI/consumer pass; performance/review/slice pending. |
| 3 — Business features | Policies, templates/SSE, comments/mentions/followers/tags/changes, assignments, saved views, import, printing, HMAC webhooks, API tokens/OpenAPI, 2FA with human ASVS review | Some primitives exist; phase remains gated. |
| 4 — Workflows | Amend-by-copy, versioned XState definitions, row locks, six node types, durable transitions/retries, approval/run/retry screens, worker/definition-change tests | Only the submission envelope exists. |
| 5 — Agent/consumers | Isolated consumers for every capability, generated catalog, full idea review/five reviewers, module removal, second k6 and autonomous resource exercise | Early skills/commands exist; phase not accepted. |
| 6 — Framework integration | API extraction, disposable independent consumer, customization/data preservation and Docker runtime/recovery verification, council 2 ADR | ADR 024 removes a permanent medical product from scope. A real published upgrade applies once a predecessor exists. |
| 7 — Public release | Complete 1.0 scope, independent consumer acceptance, public MIT repository, docs/gap reporting, configured authorized npm destination | Workflow/issue form prepared; no publication. |

Do not begin phase 3 before the upgraded/restored phase 2 slice passes. Test-only resources replace deleted educational modules as consumers; do not bring them back into the normal application's menu.

Store sanitized evidence under `docs/evidence/`. Accepted entries in `release-readiness.json` need `status: "accepted"`, a real `reviewedBy`, `reviewedAt` (YYYY-MM-DD), and evidence paths. Evidence identifies revision, environment, commands/results and human acceptance. Never synthesize external or human acceptance from local green tests.

The owner-authorized `alpha` channel distributes an experimental version without accepting phases (ADR 024). `next` requires an explicit prerelease version and phase 0/1 acceptance, allowing phase 2 to consume a published candidate. `latest` requires 1.0.0 and every phase accepted. These guards do not replace reviews. Public repository/provenance prerequisites apply to both channels.
