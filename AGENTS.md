# adula-kit development

Read adula-kit-plan.md, docs/decisions, docs/implementation-status.md and KIT_GAPS.md before extending the framework. This is the kit's source repository; changing packages/kit is expected here. Applications consuming the published package must not change its installed internals.

Use English for code/docs and Arabic for user-facing text. Keep migrations additive and immutable after release. Every feature needs a consumer and a meaningful test. Do not claim a phase complete before its acceptance gate passes. Never substitute mock authorization or SQLite for PostgreSQL authorization tests.

For UI work, use the frontend-design skill and read packages/kit/agent/skills/adula-frontend-design/SKILL.md. Design for business workflows and consistent data-dense interfaces. At project kickoff request any missing company identity (name, logo, colors, fonts and brand guide) before the first design; reuse supplied identity and record it in project-owned docs/design-identity.md. Compose project-owned shadcn/ui components instead of hand-styled native controls. All forms and row/record detail views use shadcn Dialog by default unless the user explicitly requests another presentation; semantic HTML for structure and submission is allowed. Preserve project-owned customizations and install consumer components through adula:ui.

Validation: pnpm build, pnpm typecheck, pnpm test, pnpm lint, pnpm check:boundaries. PostgreSQL 17 must be running. Tests use a dedicated *_test database. Never weaken or remove tests to hide a failure.

The user authorized the dependencies named in the implementation plan. Preserve project-owned UI and managed AGENTS boundaries. External deployment/publication requires actual destination configuration; do not invent accounts, domains or credentials.

Customers/orders/tasks were removed from normal application operation by the owner. Keep their acceptance consumers under apps/reference/tests/fixtures and never re-enable them in the normal registry or menu. See ADR 017. Stable means the complete approved 1.0 scope, with dated evidence in docs/release-readiness.json; package preparation alone is not release acceptance. Before preparing archives, also run pnpm test:release, pnpm test:consumer and pnpm check:release --artifacts=.work.
