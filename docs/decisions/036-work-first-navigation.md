# ADR 036 — One "My tasks" page and a work-first sidebar (1.2.0)

Date: 2026-09-29. Status: proposed; awaiting the owner's review in the pull request.

Issues #35 and #34. An approval request appeared both in "My tasks" and in the approvals
inbox, but could be decided only in the inbox. The sidebar listed kit links without
grouping and without checking permissions, and they crowded out the business modules.

## Decisions

1. **One "My tasks" page (#35).** Tabs: all open items, waiting for my decision, assigned
   tasks, closed. `Assignments.mine()` takes a `kind` filter (`approval` or `task`),
   counts open approvals (`AssignmentPage.approvals`) and marks the rows the user can
   decide now (`Assignment.canDecide`, the checks `WorkflowEngine.decide()` applies).
   Approval and decision rows are decided in place with the same `WorkflowDecision`
   dialog as before, including named outcomes from ADR 031; the page takes the runs from
   `WorkflowEngine.inbox()`. Manual tasks keep the closing-note dialog from ADR 029.
   `/approvals` redirects pages to `/my-tasks?tab=approvals` and keeps its JSON inbox for
   integrations. Earlier `?status=` links still work.
2. **A work-first sidebar (#34).** Daily work comes first: overview, My tasks with an
   open-items badge, and imports only for users who can create records. The module
   groups follow, collapsible and labelled from `Module.label`
   (`ResourceNavigation.moduleLabel`). Administration is one entry for administrators,
   with a badge for failed workflows or a stale backup. Inside the administration area it
   expands into people and permissions, settings, and monitoring, with the one-time setup
   first until it is complete (`/admin` opens it). The duplicate home link and the
   workspace card are removed, and inviting moves to the account area.

## Consequences

- `pnpm check:api` reports `Assignment`, `AssignmentPage` and `ResourceNavigation` as
  changed: each gains a member (`canDecide`, `approvals`, `moduleLabel`). Code that builds
  these objects itself needs the new member.
- Projects with the starter's `layouts/workspace.tsx`, `components/admin-nav.tsx`,
  `pages/work/my_tasks.tsx`, `assignments_controller.ts` or `workflows_controller.ts`
  need the updated files; `pages/work/approvals.tsx` is removed.
- Kit tests cover `kind`, `approvals` and `canDecide`; reference browser tests cover the
  redirect, deciding from My tasks (approval and decision steps), the closing-note dialog
  and the sidebar for administrators and ordinary users.
