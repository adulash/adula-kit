# Business features (phases 3 and 4)

How to use the kit's business features in an application. Every feature is a kit
service plus an additive migration; the reference application shows the wiring
(routes, controllers, pages) that `@adula/create-app` copies into new projects.
All record features call `ResourceService.access`, so they can never reach a
record the user could not open.

## Collaboration around a record

`RecordCollaboration` (`kit().collaboration`) provides comments with mentions,
followers, tags and field history. ResourceShow renders the `record-collaboration`
panel automatically.

- Mentions and follower notifications only reach users who can read the record;
  mentioning anyone else is refused.
- Tags require update permission; lists filter with `?tag=<name>`.
- Every update stores before/after values in `field_changes` inside the save
  transaction. Readers only see changes of fields they may read.
- `followerListeners(registry, () => kit().collaboration)` notifies followers of
  updates and document transitions.

## Assignments and "my tasks"

`Assignments` assigns work on a record (update permission required; the assignee
must be able to read the record). `/my-tasks` lists the user's tasks; only the
assignee completes and only the assigner cancels. Approval steps of workflows
create assignments of kind `approval`.

## Notifications, templates, e-mail and realtime

- `notifyWithTemplate(db, userId, key, variables)` writes a notification from a
  message template. Defaults live in the kit (`DEFAULT_TEMPLATES`); administrators
  edit wording at `/admin/templates` (placeholders are validated).
- Templates with mail enabled are e-mailed by the worker
  (`deliverNotificationMail`, three attempts).
- A database trigger NOTIFYs on commit; each web process forwards the signal over
  SSE (`@adonisjs/transmit`, channel `notifications/<userId>`), and the bell
  refreshes without a page reload.

## Outgoing webhooks

Administrators subscribe HTTPS endpoints to domain events at `/admin/webhooks`.
Deliveries are queued once per event, carry the event envelope only (never record
fields), and are signed:

```
X-Adula-Signature: sha256=HMAC_SHA256(secret, "<X-Adula-Timestamp>.<raw body>")
X-Adula-Delivery: <uuid>   # deduplicate on this
```

Failures retry for six attempts with growing delays; the creator is notified on
final failure and can retry from the delivery log. Private and loopback targets
are refused in production.

## API tokens and OpenAPI

Users create read or read-write tokens under their account menu. `/api/v1`
accepts `Authorization: Bearer <token>` only (no cookies, no CSRF) and exposes the
same resource operations with the token owner's current permissions.
`GET /api/v1/openapi.json` describes the resources and actions the caller may use.

## CSV import

Generic index pages offer "استيراد CSV" to users who may create records. Columns
are matched to writable fields, the worker saves each row through
`ResourceService` with the importer's permissions, and `/imports` shows progress
and row errors. XLSX is not supported yet (GAP-006).

## Printing

`GET /resources/<name>/<id>/print` renders an RTL A4 page with the fields the user
may see. Set `GOTENBERG_URL` (see `docker-compose.pdf.yml`) to add `?format=pdf`.

## Two-factor authentication

Users enable TOTP from their account menu and keep ten single-use recovery codes.
Password and OAuth sign-in then require the second factor. See
[the ASVS review record](security/two-factor-asvs-review.md). It has **not** had an
independent human security review; the owner deferred that review to 2.0
(ADR 027). Changes to it still need a human review (managed AGENTS rule 11).

## Documents and workflows

Submittable resources support submit, cancel and amend-by-copy (a cancelled
document is copied with its inline lines into a new draft).

Workflows are code in `app/modules/<module>/workflows/` and are listed in the
module's `workflows` array:

```ts
export default defineWorkflow({
  name: 'order_approval',
  version: 1,
  resource: 'orders',
  label: 'اعتماد الطلبات',
  start: 'size',
  steps: {
    size: { type: 'condition', when: (o) => BigInt(o.total ?? '0') >= 1000000n, then: 'manager', else: 'done' },
    manager: { type: 'approval', label: 'موافقة المدير', assignees: { role: 'مدير القسم' }, approve: 'mark', reject: 'rejected' },
    mark: { type: 'update', values: { status: 'approved' }, next: 'tell' },
    tell: { type: 'notify', to: 'submitter', next: 'done' },
    done: { type: 'end', outcome: 'approved' },
    rejected: { type: 'end', outcome: 'rejected', cancelDocument: true },
  },
})
```

Step types: `condition`, `update`, `notify`, `approval`, `delay`, `http`, `end`.
Submitting a document starts the newest version; the run keeps that version.
Change a workflow by adding a new version; move unfinished runs explicitly with
`WorkflowEngine.migrateRuns`. The worker advances due runs; approvers decide in
`/approvals`; failed runs are retried from `/admin/workflows`. HTTP steps send a
stable `Idempotency-Key` because a crash may repeat the call.
