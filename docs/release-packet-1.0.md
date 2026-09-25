# 1.0.0 release packet

Prepared 2026-09-25 on branch `claude/upbeat-knuth-cjalqm`. This packet lists what
is done, what the owner alone can decide, and the exact steps that publish 1.0.0
after those decisions. It grants nothing by itself: `pnpm check:release
--channel=latest` refuses 1.0.0 until every phase in `release-readiness.json` is
accepted with a reviewer, a date and evidence.

## Machine evidence (already recorded)

| Area | Evidence |
|---|---|
| Phases 3 and 4 features | `docs/evidence/phase3-implementation-2026-09-25.json`, `docs/evidence/phase4-implementation-2026-09-25.json`, guide in `docs/business-features.md` |
| Agent works without the owner | `docs/evidence/agent-module-exercise-2026-09-25.json` |
| k6 budget (100000 rows, 50 users) | `docs/evidence/phase5-performance-2026-09-25.json` |
| Genuine upgrade from npm 0.2.0-alpha.1 | CI step `pnpm test:upgrade --published=0.2.0-alpha.1`; `docs/evidence/phase6-integration-2026-09-25.json` |
| Public API contract | `packages/kit/api/kit-api.json`, CI step `pnpm check:api` |
| Consumers, creator, Docker | CI steps `test:consumer`, `test:create`, `test:create --docker`, `check:release --artifacts=.work` |
| Repository | public, MIT, default branch `main`, GAP issue form |

## Owner decisions (cannot be produced by an agent)

1. **2FA ASVS review:** complete `docs/security/two-factor-asvs-review.md` or
   waive it in writing for 1.0 (managed AGENTS rule 11).
2. **Phases 0 and 1 open items:** natural daily/monthly scheduling, staging and
   production supervision. ADR 024 already selected local Docker staging; the owner
   either attests these as for phase 2 (ADR 025) or keeps them open.
3. **Phases 3, 4, 5 and 6:** accept on the recorded evidence, or name what to fix.
4. **Council 2:** accept or amend ADR 026, including whether 1.0 needs an operated
   production consumer (plan phase 7) or follows ADR 024.
5. **Phase 7 and publication:** authorize `1.0.0` on `latest`.

## Steps after the decisions

1. Record each decision as an ADR and dated evidence; set the phases to
   `accepted` with `reviewedBy`/`reviewedAt` in `release-readiness.json`.
2. Bump kit, UI and creator to `1.0.0` (workspace, reference, agent and UI locks,
   creator template pins, capability catalog), move the changelog's Unreleased
   section to 1.0.0, run `pnpm build typecheck lint test check:boundaries
   test:release test:consumer check:release --artifacts=.work`.
3. Open a pull request to `main`; merge after CI passes (the genuine upgrade then
   crosses a minor version, so the UI compatibility review gate is exercised).
4. Tag `v1.0.0` on the merge commit and run the "Release npm packages" workflow
   with version `1.0.0` and channel `latest`. It re-verifies the tag, the
   acceptance file and CI before publishing with provenance.
5. Verify `npm view @adula/kit@1.0.0`, `npm create @adula/app@latest` in an empty
   directory, and record the publication evidence.
