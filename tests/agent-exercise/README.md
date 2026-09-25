# Phase 5 agent exercise — a fourth abstract module from one sentence

Record of the plan's phase 5 acceptance exercise, kept for review. It is not
loaded by the reference application (ADR 017 keeps example modules out of its
registry). The files were produced in a disposable copy of the reference consumer
(`.work/agent-exercise`, database `adula_agent_test`).

**Sentence (Arabic, as a user would type it):**

> أضف وحدة دعم فني فيها تذاكر لكل منها رقم تسلسلي وموضوع وأولوية من قائمة ووصف قابل
> للبحث وتاريخ استحقاق وردود داخل التذكرة، وعند اعتماد تذكرة عالية الأولوية يوافق عليها
> مشرف الدعم فتُعلَّم مصعّدة ويُبلَّغ مقدمها.

**idea-review blueprint (from `node ace adula:capabilities`):** module `support`, no
dependencies; `tickets` (scoped, submittable; `number` sequence TKT unique, `subject`
required/searchable/sortable, `priority` lookup `ticket_priority`
low/normal/high required/filterable, `description` searchable text, `dueOn` date,
`escalated` boolean set only by the workflow, `replies` inline); `ticket_replies`
(scoped, versioned; `ticketId` belongsTo, `body` required). Workflow
`ticket_escalation@1`: condition → approval by role «مشرف الدعم» → update
`escalated` → notify submitter → end. Everything is "now"; nothing outside the kit.

**Steps:** `adula:resource tickets --module=support`, `adula:resource ticket_replies
--module=support`, then the definitions, immutable migrations, validators, models,
factories, the workflow, contract fixtures and an escalation test.

**Automatic checks caught and the agent corrected (no human correction):**
1. Typecheck: generated factories still used the scaffold `title` field.
2. Contract tests: the priority lookups are truncated with the test database
   (fixtures must insert them) and the inline `replies` fixture was missing.
3. The reference-only `fixture_isolation.spec.ts` fails by design in any copy that
   registers a module; it was removed from the disposable copy, as a consumer
   project would not have it.

**Result:** lint, three typecheck projects and 191 functional tests passed (generated
403/404/uniqueness/scope contracts for both resources plus the escalation flow over
HTTP). `adula:doctor` flags only the kit-version step (`adula:install`) and the
reference's known shared-test-database migration note.

**Reviewers:** see `docs/evidence/agent-module-exercise-2026-09-25.json`.
