# ADR 032 — User fields and the current-actor condition (1.1.0)

Date: 2026-09-29. Status: accepted by the owner for 1.1.0. After the decisions were explained,
the owner accepted the two open points: that users who may edit a user field see the names
of eligible users in ancestor units, and that `canQueryField` stays unchanged. The owner
stated in conversation: "موافق على الأمرين، سجّل الموافقة في ADR 032" (agreed on both
points; record the approval in ADR 032). The owner also set the rule that the kit changes
only what serves any resource.

Issues #28 and #29. Records often point at a person: an assignee, a reviewer, an
inspector. `belongsTo` accepts only registered resources and users are core tables, so
consumers stored an e-mail address and matched it in module code. Role conditions
accepted literal values only, so "the records assigned to me" or "the records I created"
could not be granted, and module pages authorized those writes themselves. Both changes
are additive and belong to 1.1.0. The kit changes only what serves any resource.

## Decisions

1. **A `user` field type.** `{ type: 'user' }` is an integer foreign key to `users` with
   `ON DELETE RESTRICT` and an index (`createResourceTable`).
   - Eligible users are active (`disabled_at IS NULL`) members of the record's unit or
     one of its ancestors: the users the record is visible to through membership. On
     unscoped resources, eligible users share organization scope with the actor: members
     of the actor's units, their descendants or their ancestors.
   - Saving checks eligibility when the value changes, and when a user moves the record
     to another unit, including a move made by a `beforeSave` hook. An unchanged value
     never blocks other edits, even after the account is disabled.
   - `systemSave` checks the record's unit on scoped resources. On unscoped resources it
     accepts any active member, unless the caller passes `chooser`: the person who chose
     the value, whose scope then applies. Workflow decision steps (ADR 031) pass the
     approver.
   - Choices come from `/resources/:resource/options/:field`, searched by name, 50 per
     page. Workflow decision forms get the users eligible for the document.
   - Readers get `related.<field>` as `{ id, fullName }`, never the e-mail address.
   - The field can be filtered, sorted (by user id), imported by id, printed by name,
     described in OpenAPI as an integer, and pre-filled with `?defaults[field]=<id>`.
     It is not a `title` part.
2. **The `$actor.id` condition value.** A role condition may use the reserved string
   `'$actor.id'` (`ACTOR_ID`) on `createdBy`, `updatedBy` and user fields, with `$eq`,
   `$ne` or `$in`, for example `{ assignee: '$actor.id' }`.
   - The stored rule keeps the placeholder. `ActorStore` replaces it with the loaded
     user's id, on registered resources only on those fields, so CASL, `canRecord`,
     `conditionSql`,
     `accessibleBy` and the client rules compare an integer, and SQL binds it as a
     parameter.
   - An unresolved placeholder makes `buildAbility` and `conditionSql` throw. Compared as
     text, `$ne` and inverted rules would match every record. This covers a placeholder on
     another field that was written without `RolesAdmin`, and hosts that build actors
     themselves (they call `resolveActorConditions`).
   - `RolesAdmin.setRule` refuses the placeholder elsewhere. The role matrix marks the
     accepted fields (`MatrixField.actor`), and the starter role screen offers an
     «المستخدم الحالي» toggle for them.
   - Only the id is supported.
   - `canQueryField` is unchanged: any conditional rule on the resource keeps sorting,
     filtering and search by field closed for that actor.

## Consequences

- **What becomes configuration.** "Update the records assigned to me" is a role with
  `view` and `update` where `{ <user field>: '$actor.id' }`. Inline rows follow their
  parent's rule, because saving them requires update access to the parent.
- **Security properties.**
  - Every actor path loads through `ActorStore`: sessions, API tokens, MCP,
    impersonation, imports and workflows. The actor cache key contains the user id.
  - Accepted disclosure: a user who may edit a user field sees the names, not the
    e-mails, of eligible users, including members of ancestor units such as the head
    office.
- **Limits, deferred.**
  - An actor whose rules on a resource are conditional cannot filter it by a user field,
    so "assigned to me" is not a list filter for such a role (`canQueryField`).
  - A condition cannot refer to a field of a parent record.
  - Before the unit is known, choices follow the actor's scope, and saving may refuse
    them. This applies to a new record whose unit comes from its parent (`scope.from`)
    and to inline rows.
  - Inline-row choices require create access to the child resource.
- **Upgrade.** The copied `data-table`, `resource-field`, `resource-form` and
  `resource-value` components changed, and so did the starter role screen. `Field` gains
  `{ type: 'user' }`, which code that switches exhaustively over `Field['type']` must
  handle. The CHANGELOG lists the API details.
- **Evidence.** Kit tests on PostgreSQL cover eligibility, unit moves by users and hooks,
  serialization, system writes with and without a chooser, decision choices, defaults,
  and the placeholder in CASL, SQL, inverted rules and unresolved rules. The test-only
  `order_inspections` fixture (ADR 017) runs the HTTP security contract and an HTTP
  rule test; the role screen and the user picker have browser tests.
