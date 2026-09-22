# npm operational acceptance review — 2026-09-22

Decision: **not ready for npm release acceptance**. This review does not accept a
phase, authorize publication, or replace the complete approved 1.0 scope.

Reviewed on `codex/npm-operational-acceptance`, based on
`264c4277582a8e566523a7631a7333edc6c0f071` plus the existing uncommitted operational
backup changes. Those changes were preserved. Machine-readable results are in
[the evidence record](evidence/npm-acceptance-review-2026-09-22.json).


Follow-up: this review records the earlier checkpoint. Docker was subsequently located in Ubuntu WSL; local container recovery, accelerated scheduler dispatch and corrected offsite monitoring passed. See [Docker evidence](evidence/docker-backup-2026-09-22.json), [schedule evidence](evidence/scheduled-backup-2026-09-22.json) and [monitor repair](evidence/backup-monitor-repair-2026-09-22.json). Staging, natural calendar operation and release acceptance remain pending.

## Executed validation

Build, typecheck, lint, boundaries and all 295 local tests passed against real
PostgreSQL 17.6 with the dedicated `adula_test` database. Five release-guard tests
passed. The independent packed consumer passed 15 HTTP tests, customization
protection, repeated installation, module archival, doctor, typecheck and production
build. Its first dependency installation was blocked by sandbox network access;
the network-enabled retry passed. All four deployment shell scripts passed syntax
checks. Current kit/UI archives and the refreshed creator archive passed package
checks. Both explicit publication-channel checks correctly rejected version 0.2.0.
No Docker, staging or k6 run, real minor upgrade, or human review was performed.

## Findings

1. **Performance workload cannot establish the phase 2 budget.**
   `apps/reference/tests/perf/k6-workload.js` authenticates only in `setup()` and
   returns resource IDs, without establishing sessions in the VU cookie jars.
   It targets customers/orders, which are intentionally absent from normal
   operation under ADR 017. Its documented seed command is forbidden in production
   and only creates business rows in test mode. Sharing the single configured
   account among 50 VUs would also encounter the 300 requests/minute/user API
   limiter; logging each VU into that account encounters the login limiter.
   Failed content checks have no `checks` threshold, and latency samples include
   unsuccessful requests. Cached Ability construction has no measurement, despite
   its <5ms budget in plan section 13. The suite therefore needs an isolated
   acceptance consumer with representative data and distinct authorized users,
   functional success gates and all required measurements before a k6 run counts.
   Do not enable the removed examples in normal operation or disable authorization
   and throttling to make this workload pass.

   k6 documents [per-VU cookie jars](https://grafana.com/docs/k6/latest/using-k6/cookies/)
   and that [failed checks need thresholds to fail a run](https://grafana.com/docs/k6/latest/using-k6/checks/).

2. **The upgrade harness is a synthetic migration regression, not release evidence.**
   `scripts/test-upgrade.mjs` rewrites source package versions and removes a
   migration from the current build to synthesize 0.1.0. Setting
   `ADULA_PREVIOUS_VERSION` still uses that synthetic path. It neither obtains a
   released predecessor nor restores a medical-assets consumer's attachment.
   Do not run it as proof of the real minor-upgrade gate. Retain its useful
   customization/migration assertions when implementing a separate genuine
   predecessor-to-candidate exercise with recorded package integrity.

3. **Container and schedule acceptance is still absent.** Docker and k6 were not
   found on PATH; Docker was also absent from its conventional Windows executable
   location. No staging destination was supplied or identified in the reviewed
   deployment configuration. The user does not know of an existing destination
   or published predecessor. Local restore tests exercise commands and files, not
   Docker volume ownership, actual daily execution, monthly scheduler dispatch,
   Caddy/TLS, service supervision or recovery with traffic stopped. The existing
   scheduler mount test checks Compose text; its title is not evidence of runtime
   access. CI contains a creator Docker test, but that is not a production Compose
   backup/restore deployment exercise and no remote run was performed here.

4. **Human visual acceptance and the independent slice remain pending.** Browser
   tests and generated screenshots do not identify a human reviewer. A fresh
   packed consumer verifies installation, not a genuine upgrade or the required
   medical-assets slice. No human approval is inferred from automated success.

## Concrete acceptance sequence

1. Configure a real isolated staging host, hostname/TLS and deployment-owned
   secrets. On a Docker-capable host, validate Compose, build the exact revision,
   start PostgreSQL 17/Redis/web/worker/one scheduler/backup, and record image IDs,
   health and runtime versions. Keep databases and objects separate from live data.
2. Create a synthetic record with an attachment through the consumer. Observe an
   actual scheduled snapshot and verify the offsite marker and artifact hashes.
   Observe the monthly job dispatch, with any isolated-test schedule acceleration
   documented. Verify that the deployed scheduler user can read the backup volume.
   Perform stopped-traffic recovery into an isolated destination; prove authorized
   byte-exact download, access denials and worker/cache reconciliation. Keep
   sanitized timestamps and logs for every step.
3. Build the independent medical-assets acceptance slice and its performance
   workload. Verify 100,000 representative rows, 50 distinct authorized users,
   actual relation data, functional success and the list/save/Ability budgets.
   Capture k6 output, application/database metrics and host sizing. Local smoke
   timings do not accept staging performance.
4. Have the owner review desktop/mobile RTL list, create/edit/detail dialogs,
   validation, permissions, attachment flows and keyboard behavior. Record the
   actual reviewer, date and accepted/rejected screens. Review artifacts are
   generated under `.work/screenshots/`; do not fabricate a sign-off.
5. Once phase 0/1 acceptance and the publishing destination are configured, the
   guarded `next` channel can supply an explicitly authorized prerelease baseline.
   Preserve a genuine independent consumer with customized component/page,
   project identity, managed AGENTS boundaries and record/attachment data. Upgrade
   it to a genuinely different minor version, verify migrations and customization
   hashes, then restore its snapshot and verify the record/file through HTTP.
   Two repacks of current source do not satisfy this step.
6. Record council 1 and dated human acceptance before starting phase 3. All later
   approved phases and production acceptance still apply to `latest`/1.0.0.

Do not treat `pnpm check:release --artifacts=.work` as publication authorization:
without `--channel`, it validates package contents, not phase acceptance.
