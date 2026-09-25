---
name: module-review
description: Review a module's boundaries, dependencies, events and scope before merging.
---

Check, citing file and line for every finding:

- The module lives in `app/modules/<name>` and is registered in `start/modules.ts`
  after every module it depends on; `dependsOn` lists each module whose resources
  it references. `ResourceRegistry.register` must accept the order.
- It writes only its own tables. Cross-module effects happen in idempotent
  listeners (`consumeEvent` + processed_events), never by importing another
  module's controllers or services. Heavy listeners dispatch jobs.
- Every resource declares `scoped`. Central (`scoped: false`) resources are
  justified; scoped ones rely on the kit's organization scope, not custom filters.
- Documents that need approval use `submittable: true` and a module workflow; the
  operational status is a lookup separate from `docStatus`.
- No kit service is re-implemented under another name (notify, sequence, settings,
  assignments, comments, imports, webhooks, workflows).
- Educational fixtures are not imported by the application.

Verdict: accept, or a numbered list of blocking findings.
