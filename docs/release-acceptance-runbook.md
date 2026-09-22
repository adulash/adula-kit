# Release acceptance execution packet

Prepared 2026-09-22; updated by [ADR 024](decisions/024-framework-alpha-and-local-staging.md).
The owner now authorizes local Docker staging, a GitHub PR merged after successful
CI, and npm `0.2.0-alpha.1` on `alpha`. No phase or human visual acceptance follows
from that authorization. `latest` and `next` remain blocked.

Run `pnpm release:status` (or `pnpm release:status --json`) to see both channel guards
and every remaining phase. Exit 1 means at least one channel is blocked. This is a
read-only diagnostic; it neither changes readiness nor grants publication authority.
The canonical gates remain [1.0 acceptance](acceptance-1.0.md) and
[release-readiness.json](release-readiness.json).

## 1. Staging and natural scheduling

The owner selected local Docker as staging. Use isolated PostgreSQL/Redis/storage
namespaces and loopback-only ingress; record the image, health and checks below.
External SSH, public DNS and TLS are not prerequisites for this selected environment.
The owner reports personally testing operations. Retain that attestation separately
from measured timer evidence. The following natural-schedule checklist remains
guidance for real deployments, not a claim that a month elapsed in this run.

Follow [Docker operations](docker-operations.md) and the application Makefile.
Record the exact source commit, image digests, CPU/RAM, Node/PostgreSQL/Redis versions,
Compose validation (`docker compose -f docker-compose.prod.yml config --quiet`),
TLS, health, worker heartbeat and exactly one scheduler. Keep secrets outside Git.

- Create an authorized record with a bound attachment. Record its ID, disk, length
  and SHA-256, and exercise access-denial tests.
- Observe at least two daily completions separated by the unchanged 86400-second
  loop. The startup snapshot and manually invoking `once` do not prove the loop.
  Record container start times/restarts so these cannot be mistaken for timer firings.
- Observe `backup:restore-test` under the unchanged `.monthly()` schedule. Record
  scheduler timezone and next due time beforehand. Keep accelerated timer evidence
  separate; do not change the host clock to pass.
- Capture offsite artifact checksums, final `COMPLETE`, backup-volume readability,
  record/file restoration and `backup.lastRestoreTest`. Do not use `--allow-empty`.
- Recover with traffic stopped into a selected disposable destination using
  `make restore FILE=/backups/<actual-snapshot>`. Record destination database identity,
  verification before recovery, original disk configuration and runtime reconciliation.
  Prove byte-exact authorized HTTP download and access denials after recovery.
  Keep traffic stopped on failure. Verify actual supervision/restart behavior.

Evidence must identify source revision, environment, UTC observation start/end,
commands/exit codes, snapshot/checksum references, expected/actual outcomes and a
named reviewer. Sanitize logs. Natural scheduling requires elapsed time; neither
local tools nor the existing accelerated evidence can manufacture that result.

## 2. CI, branch protection and npm destination

The [release guide](releasing.md) owns the actual package/repository/workflow mapping.
The existing workflow is preparation, not proof of configured services. After
separate authorization for remote work:

1. Push the reviewed revision. Record a real successful CI run URL/head SHA, job
   results, PostgreSQL 17, consumer/creator results and retained archive checksums.
2. Establish `main`/`staging` and main protection: PR review, the actual successful
   CI check name, current-base requirement and force-push/deletion restrictions.
   Record effective rules and bypass policy. Verify that a failing/unapproved change
   cannot merge without weakening protection. Do not guess the check name.
3. Configure the `npm` environment with required reviewers and only `main` allowed.
   Record sanitized configuration and the job's waiting-for-approval behavior.
4. Configure trusted publishers for all three packages using the release guide's
   owner/repository/workflow/environment. Resolve initial bootstrap with the owner
   if required. Do not use a token to bypass missing publisher configuration.
5. Verify public-source/provenance prerequisites. Keep publication blocked until
   phase 0/1 is accepted and an explicit prerelease is selected for `next`.
   Record actual publishing/provenance results only after authorized publication.

Account capabilities must be verified when remote work is authorized; a checked-in
workflow does not demonstrate branch protection, environment review or npm access.

## 3. Performance and human interface review

The repaired k6 harness takes an explicit independent-consumer fixture, logs each
VU in with a distinct user, retains its cookie jar, checks both preloaded relations
and the saved record, and aborts on functional failures. Only valid responses enter
latency trends. Node contract tests verify measurement behavior, not actual
k6 throughput or PostgreSQL authorization.

For the local disposable consumer, follow [the medical acceptance fixture](../tests/medical-consumer/README.md)
and run `pnpm test:medical`. It installs local archives into a separate application,
generates four resources, tests real authorization, seeds 100000 assets and 50 users,
measures cached actor/Ability construction, and exercises record-plus-file recovery.
Set `K6_BINARY` to include the 50-user workload. The owner waived branding for this
temporary test; it does not become a customer product or alter the reference menu.
Its private fixture and logs stay under `.work`. Local results still require the
staging run and genuine published-version upgrade below.

Create a private `.work/performance-fixture.json`, following this schema example:

```json
{
  "baseUrl": "http://127.0.0.1:3341",
  "isolated": true,
  "resource": "assets",
  "uniqueField": "name",
  "runId": "replace-per-run",
  "relationFields": ["locationId", "categoryId"],
  "users": [{
    "email": "load-1@example.test",
    "password": "replace-with-private-test-credential",
    "saveBody": {"orgUnitId": 1, "locationId": 1, "categoryId": 1}
  }]
}
```

This is not a seeded application or configured destination. Supply the consumer's
real field names/IDs, a new run ID and 50 distinct authorized users. `uniqueField`
must be a writable, serialized unique string. Both relations must be readable.
Verify 100,000 actual representative rows, relation/scope distribution and user
access through consumer PostgreSQL tests. Preserve sessions, CSRF, scope, field
permissions and production rate limits. The harness writes records; use only the
selected disposable consumer with synthetic data and private credentials.

```sh
k6 run -e PERF_FIXTURE=/absolute/private/performance-fixture.json -e VUS=50 -e DURATION=3m --summary-export=.work/k6-summary.json apps/reference/tests/perf/k6-workload.js
```

Reduced VUs/duration are smoke checks only. Do not override thresholds or cookie
options for acceptance. Retain command/config, k6 version, summary, seed counts,
host sizing, app/database metrics and source/package revisions. Required p95:
list with two relations <300ms and save <200ms, successful functional checks and
nonempty successful samples. No application limiter is disabled for this workload.

**Cached actor/Ability passed locally at 1.25ms p95 on 2026-09-22** (500 samples,
50 warm-up loads, real revision invalidation). See
[the dated consumer evidence](evidence/medical-consumer-2026-09-22.json).
This does not accept staging: repeat the real cached actor/Ability path there with
raw samples, cache hit/invalidation evidence and the same timing boundary. HTTP
list latency is not a substitute. References: [VU cookie jars](https://grafana.com/docs/k6/latest/using-k6/cookies/),
[persistent iteration cookies](https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/#no-cookies-reset),
[thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/).

For human review, retain dated desktop/mobile artifacts for RTL lists, filters,
sorting/pagination; create/edit/detail Dialogs; keyboard/focus/close confirmation;
validation/conflicts; hidden/denied fields; inline rows; attachments; administration;
and calendar preferences. Record reviewer, date, revision, viewport, artifact hash,
decision per screen, defects and retest. Automation/agent inspection is not human
approval. The owner waived identity for the temporary medical test application;
do not request branding for that fixture. Other consumers retain the normal
project-owned identity requirements.

## Owner inputs for final release preparation — 2026-09-22

The owner requested final publication preparation and confirmed that the medical
test application is temporary, needs no identity, and will be deleted. This does
not accept a phase or lift the existing `latest`/`next` guards. Retain its acceptance
artifacts until their evidence has been reviewed; this packet does not delete it.

Resolve the following before dependent external work:

- Actual staging host, SSH user/configured access, domain, deployment directory,
  capacity and isolated service/storage destinations. Do not put secrets in docs.
- Explicit lifting of the earlier local-only restriction, the GitHub repository,
  npm owner and authorized publication scope. A separate experimental channel,
  if requested, needs an explicit policy decision; it must not bypass the current
  release workflow or be represented as accepted `next`/`latest`.
- The previously published baseline version and independent consumer location,
  or confirmation that no published baseline exists. No synthetic predecessor.
- Named human interface reviewer, backup/restore schedule and timezone,
  operational owner and the actual observation window.
- The production consumer that will satisfy phases 6/7 after the disposable
  application is removed, or an explicit owner decision to amend that requirement.
  The temporary test application cannot be counted as a production consumer.

While these inputs are pending, local performance diagnosis and existing phase
0–2 implementation/validation may proceed. Phases 3–7 remain gated by phase 2.

## 4. Independent slice, genuine upgrade and complete 1.0

`pnpm test:consumer` proves packed installation. `pnpm test:upgrade` refuses
ambiguous use; `pnpm test:upgrade:synthetic` explicitly runs the existing regression.
The latter rejects `ADULA_PREVIOUS_VERSION` before filesystem/database mutation and
never obtains a published predecessor. It does not establish upgrade acceptance.

The genuine exercise needs an independently published baseline after phase 0/1
acceptance, and a genuinely different minor candidate. Until both exist this gate
remains blocked. Do not relabel source or remove migrations to invent a predecessor.

1. Create the medical-assets slice in its own repository through public entrypoints
   and project-owned modules/UI. Include scope, relations, inline children, field
   permissions and attachments. Follow idea-review/design rules. Keep removed
   educational resources out of normal operation.
2. Record exact baseline versions, registry integrity/provenance, lockfile, commit
   and migration inventory. Customize a copied component and overridden page.
   Hash them, project identity and unmanaged AGENTS content. Persist a record/file.
3. Take an offsite snapshot. Install the exact new minor candidate and record its
   integrity. Run doctor, additive migrations, managed skills/UI compatibility
   review, types/tests/build. Verify project-owned hashes and the existing record/file.
4. Restore the pre-upgrade snapshot into isolated database/storage; run the selected
   version's migrations and runtime reconciliation. Prove record/children/file bytes
   and HTTP denials. Record both environments and every exit code. Database-only
   recovery does not satisfy the attachment gate.
5. Obtain human acceptance and council 1 ADR before phase 3.

Phases 3–7 retain the complete scope in [1.0 acceptance](acceptance-1.0.md): business
collaboration/notifications/import/printing/webhooks/tokens/2FA; document lifecycle
and durable versioned XState workflows; capabilities/five reviewers/feature consumers;
full production medical-assets app with upgrade/monthly restore and council 2; then
public release. Every feature needs a consumer and meaningful test. No phase is
promoted by this preparation.

## Validation and handoff

Run build, typecheck, test (PostgreSQL 17, dedicated `*_test` databases), lint,
boundaries and `pnpm test:release`. Before archives also run the independent consumer
and archive checks in the release guide. Save actual dated results/limitations in
`docs/evidence/`. Review evidence before changing acceptance/reviewer fields. Do not
copy this checklist into evidence as a passed result.
