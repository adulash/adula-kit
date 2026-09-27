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
must be able to read the record). `/my-tasks` lists everything waiting for the
user in tabs: all, approvals waiting for their decision, assigned tasks and
closed items. Only the assignee completes and only the assigner cancels.
Approval steps of workflows create assignments of kind `approval`, decided in
place on the same page (`canDecide`); `/approvals` redirects there. Items name
their record by its business identifier (`recordTitle`, from the resource's
`title` fields or its sequence and first list field).

## Notifications, templates, e-mail and realtime

- `notifyWithTemplate(db, userId, key, variables, templates?, target?)` writes a
  notification from a message template; `notify(db, userId, title, body, target?)`
  writes one directly. A `{ resource, recordId }` target makes the notification open
  that record (the record page authorizes the reader when it is opened). Defaults live in the kit (`DEFAULT_TEMPLATES`); administrators
  edit wording at `/admin/templates` (placeholders are validated).
- Templates with mail enabled are e-mailed by the worker
  (`deliverNotificationMail`, three attempts).
- A database trigger NOTIFYs on commit; each web process forwards the signal over
  SSE (`@adonisjs/transmit`, channel `notifications/<userId>`), and the bell
  refreshes without a page reload. The tabs of one browser share one stream: a
  leader tab (Web Locks) holds it and relays signals over a BroadcastChannel.

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

## Inbound webhooks

Administrators add inbound sources at `/admin/webhooks` (section «الروابط الواردة»).
Each source has a key, a generated secret (shown once, rotatable) and header names
that default to GitHub's. Senders post to `POST /webhooks/in/<key>`:

```
X-Hub-Signature-256: sha256=HMAC_SHA256(secret, <raw body>)
X-GitHub-Event: pull_request          # the event name
X-GitHub-Delivery: <id>               # deduplicated per source
```

A missing or wrong signature is refused before anything is stored. Each delivery
is stored once and raised through the outbox as `inbound.<key>.<event>` with the
payload `{ source, delivery, event, body }`. Modules react with an idempotent
listener in `start/listeners.ts`, for example:

```ts
{
  name: 'projects.link_pull_requests',
  event: 'inbound.github.pull_request',
  handle: async (event, trx) => {
    const body = event.payload.body as { pull_request?: { title?: string } }
    // Find TSK-000123 in the title and move the task, inside trx.
  },
}
```

The delivery log shows every stored delivery and can raise it again.

## API tokens and OpenAPI

Users create read or read-write tokens under their account menu. `/api/v1`
accepts `Authorization: Bearer <token>` only (no cookies, no CSRF) and exposes the
same resource operations with the token owner's current permissions.
`GET /api/v1/openapi.json` describes the resources and actions the caller may use.
`GET /api/v1/resources/<name>/aggregate?groupBy=status&sum=total&where={json}` counts
and totals the records the token may view (`ResourceService.aggregate`); fields the
caller may not query are refused.

## CSV import

Generic index pages offer "استيراد CSV" to users who may create records. Columns
are matched to writable fields, the worker saves each row through
`ResourceService` with the importer's permissions, and `/imports` shows progress
and row errors. XLSX is not supported yet (GAP-006).

## Printing

`GET /resources/<name>/<id>/print` renders an RTL A4 page with the fields the user
may see. Set `GOTENBERG_URL` (see `docker-compose.pdf.yml`) to add `?format=pdf`.

## Two-factor authentication

Not part of 1.0. The owner moved 2FA to 2.0 (ADR 027); it returns there with a
human ASVS review.

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
    manager: { type: 'approval', label: 'موافقة المدير', assignees: { role: 'department_manager' }, approve: 'mark', reject: 'rejected' },
    mark: { type: 'update', values: { status: 'approved' }, next: 'tell' },
    tell: { type: 'notify', to: 'submitter', next: 'done' },
    done: { type: 'end', outcome: 'approved' },
    rejected: { type: 'end', outcome: 'rejected', cancelDocument: true },
  },
})
```

Step types: `condition`, `update`, `notify`, `approval`, `delay`, `http`, `end`.
`{ role }` recipients name the role's stable key (`roles.key`, set when the role is
created or once in the roles screen). Administrators can rename the Arabic display
name without detaching approvers. A role without a key is still matched by its
name, and `adula:doctor` (`workflows.roles`) warns about such references.
Submitting a document starts the newest version; the run keeps that version.
Change a workflow by adding a new version; move unfinished runs explicitly with
`WorkflowEngine.migrateRuns`. The worker advances due runs; approvers decide in
`/approvals`; failed runs are retried from `/admin/workflows`. HTTP steps send a
stable `Idempotency-Key` because a crash may repeat the call.
