# Documentation map

The approved [v4 plan](../adula-kit-plan.md) records the intended architecture and 1.0 scope. It remains unchanged. Later explicit owner decisions are recorded in ADRs and take precedence where they change that plan, including [removal of educational modules](decisions/017-test-only-examples-and-release-gates.md).

| Question | Canonical document |
|---|---|
| How do I install the current kit? | [Installation](installation.md) |
| How do I run and test the source? | [Development](development.md) |
| How do I use collaboration, webhooks, API tokens, imports, printing and workflows? | [Business features](business-features.md) |
| What works, and what was tested? | [Implementation status](implementation-status.md) |
| What still prevents acceptance? | [Kit gaps](../KIT_GAPS.md) |
| What must pass for 1.0? | [1.0 acceptance](acceptance-1.0.md), with status in [release-readiness.json](release-readiness.json) |
| How are archives published? | [Release guide](releasing.md) |
| How do I execute the remaining release gates? | [Acceptance runbook](release-acceptance-runbook.md), `pnpm release:status` |
| What are the package contracts? | [Kit README](../packages/kit/README.md), [UI README](../packages/ui/README.md), [Creator README](../packages/create-app/README.md) |
| Why was a design chosen? | [Architecture decisions](decisions/) |
| What changed? | [Changelog](../CHANGELOG.md) |

Avoid duplicating installation commands or release status. Package READMEs link to the canonical guides. Test totals belong in implementation status; unresolved requirements belong in KIT_GAPS. Implementation is not phase acceptance until the consumer and gate pass.
