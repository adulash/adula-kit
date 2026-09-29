# ADR 031 — Workflow decision steps (1.1.0)

Date: 2026-09-29. Status: accepted by the owner for 1.1.0. The owner asked whether a decision can gate a
later step and whether a rejection can return to an earlier step (both yes: an outcome's
`next` may name any step, including an earlier one, and each return opens new
assignments). The owner then stated: "موافق، ادمج #55 بعد نجاح CI" (agreed; merge #55
after CI passes). Returning to an earlier step does not reopen the document as a draft;
the document stays submitted and only declared decision fields change.

Issue #42: an approver sometimes decides between more than two outcomes, for example
approve, reject or reassign to another inspector and date. The approver must also fill
values on a document that is locked after submission. The workaround was a plain
resource plus a module route, which duplicated the engine and the approvals inbox.

## Decision

A new step type, next to `approval` (which is unchanged):

```ts
decide: {
  type: 'decision',
  label: 'قرار رئيس الفريق',
  assignees: { role: 'رئيس فريق الزيارات' },
  outcomes: {
    approve: { label: 'اعتماد', next: 'apply', fields: ['newDate'] },
    reject: { label: 'رفض', next: 'rejected', comment: 'required' },
    reassign: { label: 'إعادة إسناد', next: 'apply', fields: ['newInspector', 'newDate'] },
  },
}
```

- A decision step needs at least two outcomes. Outcome names follow the step-name rule
  and are at most 20 characters, the size of the assignment's `outcome` column.
  `WorkflowEngine.register` refuses fields that do not exist, inline children,
  attachments, JSON and sequences.
- The step assigns approvers exactly like an approval step, so the tasks appear in the
  inbox and in My tasks. Recipient errors fail the run the same way.
- `WorkflowEngine.decide(run, actor, outcome, comment, values)` accepts only a declared
  outcome, and only that outcome's fields. A required comment is enforced. The values
  are written with `ResourceService.systemSave(..., { allowSubmitted: true })`: the
  resource validator, hooks, lookup and relation checks run, the change is recorded in
  the field history with the step and outcome as the reason, and the approver is the
  author. `allowSubmitted` exists only for this use.
- The next steps read the updated record, so a condition can branch on the approver's
  values. The run log records `decided` with the outcome, the written fields and the
  comment.
- `WorkflowRun.myApproval.decision` gives the approver the outcomes, the field
  descriptions, lookup and relation choices labelled by title, and the current values
  as the approver may read them. `WorkflowDecision` renders one button per outcome and
  a dialog with those fields.

## Consequences

- An approval step still accepts only approve and reject, and now refuses values.
- Adding `DECIDE` to `WorkflowEvent` and `decision` to `WorkflowStep` widens public
  types, which is a minor change.
- Not included: per-outcome permission rules beyond the step's assignees, and fields
  that are not stored on the document itself.
