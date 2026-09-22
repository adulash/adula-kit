# Preparing and publishing packages

**Publication is being prepared.** On 2026-09-22 the owner authorized a PR, passing CI and merge to `adulash/adula-kit`, then the explicit `0.2.0-alpha.1` release on `alpha`. `latest` and `next` remain blocked. See ADR 024.

## Destination

| Setting | Actual value / state |
|---|---|
| npm organization | `@adula`, reserved by the owner |
| Packages | `@adula/kit`, `@adula/ui`, `@adula/create-app` |
| Repository | `adulash/adula-kit`; visibility verified before provenance publishing |
| Workflow | `release.yml` |
| GitHub environment | `npm`; configure required reviewers and restrict branches to `main` |
| Authentication | npm trusted publishing, GitHub-hosted runner, OIDC |
| Current version / target | 0.2.0-alpha.1 unreleased / complete 1.0.0 |

Configure a trusted publisher for **each package**: owner `adulash`, repository `adula-kit`, workflow `release.yml`, environment `npm`, with publishing permission. If npm requires an authenticated initial package bootstrap, resolve it separately with the owner. The workflow does not establish account setup or supply credentials.

npm trusted publishing requires at least npm 11.5.1 and Node 22.14; the workflow uses Node 24 and npm 11. Public provenance requires public source and package visibility. See [trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [provenance](https://docs.npmjs.com/generating-provenance-statements/). No npm token belongs in source.

## Local preparation

`pnpm release:status` lists both channel failures and all remaining phases; use
`--json` for a machine-readable report. It returns exit 1 while either channel is
blocked and never changes acceptance. Follow the [execution packet](release-acceptance-runbook.md)
for staging/schedule, CI/publisher, performance/human review and genuine-upgrade evidence.

Run the full [development checks](development.md). `pnpm test:consumer` and `pnpm test:create` produce the tested archives, then:

```sh
pnpm test:release
pnpm check:release --artifacts=.work
pnpm check:release --channel=latest
```

The last command **must fail today**: 0.2.0-alpha.1 is not complete 1.0. Packaging checks validate versions, provenance metadata, licensing, skills/commands, exports, UI assets and absence of private/test files, then write `.work/SHA256SUMS`. They do not establish product stability.

When acceptance justifies a candidate, update all three package versions, workspace/reference versions, agent/UI lock versions, changelog and `release-readiness.json`; rebuild and repeat both consumer tests. The creator pins matching kit/UI versions in its bundled template. Keep migrations additive. Previews use an explicit prerelease such as `1.0.0-rc.1` on `next`; stable uses `v1.0.0` on `latest`. These are future examples, not existing releases.

## Authorized remote release

1. After explicit authorization, push the reviewed code, establish main/staging and branch protection, and review the first real CI run.
2. Complete acceptance evidence, create an annotated `v<version>` tag on reviewed `main`, and push it only within an authorized release.
3. Run **Release npm packages** manually on `main` with the version/channel. It verifies public visibility, tag ancestry, matching versions and acceptance.
4. Reusable CI checks that exact commit: build, types, lint, PostgreSQL/runtime/browser tests, release guards, independent consumer, boundaries and dependency audit. It retains the exact consumer-tested archives/checksums.
5. The protected `npm` job verifies downloaded checksums/acceptance and publishes those archives with provenance, without rebuilding or passing publication credentials to tests.
6. Verify all three npm versions, dist-tags, provenance and the scoped npm create entrypoint before creating release notes or claiming completion.

The workflow does not push tags, modify account settings or deploy applications. Application deployment separately follows its configured `make deploy` and restore gates.

## Failure handling

Multi-package publication is not atomic. Publish kit/UI before the creator. If any publish fails, do not unpublish prior packages or blindly rerun all publishes. Inspect npm, compare published integrity with retained archives, and publish only missing packages through the approved environment. Different bytes require a new version and checks; never force-move tags or reuse a version.

Artifacts are retained for 14 days. Preserve final integrity and acceptance in durable release evidence; ignored `.work` logs remain local diagnostics.
