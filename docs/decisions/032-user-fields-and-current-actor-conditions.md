# ADR 032 — User fields and the current-actor condition (1.1.0)

Date: 2026-09-29. Status: proposed; awaiting the owner's decision.

Issues #28 and #29. Business records often point at a person: an assignee, a reviewer,
an inspector. `belongsTo` accepts only registered resources, and users are core tables,
so consumers stored an e-mail address instead. The clinic supervisory-visit project
matches `inspector` and `clinic_staff` e-mails to the signed-in user on every request,
and cannot grant "update the visits where I am the inspector", so its module pages
authorize every write themselves (see the owner's comment on #28). Both changes are
additive and belong to 1.1.0.

## Decisions

1. **A `user` field type.** `{ type: 'user' }` is stored as an integer foreign key to
   `users` with `ON DELETE RESTRICT` and an index (`createResourceTable`).
   - Choices are active users (`disabled_at IS NULL`) who are members of the record's
     organization unit or one of its ancestors, that is, the users the record is visible
     to through membership. They are served by the existing
     `/resources/:resource/options/:field` route, searched by `full_name`, 50 per page.
     The form passes the chosen unit, so changing the unit reloads the choices.
   - Saving checks the same rule on the server when the value changes, and when a user
     moves the record to another unit. An unchanged value never blocks other edits, even
     after the account is disabled.
   - Unscoped resources have no record unit: the choices are active users who share
     organization scope with the actor (a member of an ancestor or a descendant of one
     of the actor's units).
   - `ResourceService.systemSave` applies the record-unit rule to scoped resources and
     accepts any active member for unscoped ones, because a system write has no actor
     scope. Re-homing a child (ADR 029) does not re-check an unchanged user.
   - Lists and details return `related.<field>` as `{ id, fullName }` only. Readers of
     the record never receive the e-mail address.
   - The field can be filtered, sorted, imported by id, printed by name, described in
     OpenAPI as an integer, and pre-filled with `?defaults[field]=<id>` when the user is
     eligible for the actor. The list filter offers users who share the actor's scope.
   - Not a `title` part: titles stay limited to text, number, money, date and lookup.
2. **The `$actor.id` condition value.** A role rule condition may use the reserved string
   `'$actor.id'` (exported as `ACTOR_ID`), for example `{ inspector: '$actor.id' }` or
   `{ createdBy: { $in: ['$actor.id', 1] } }`.
   - The stored rule keeps the placeholder. `ActorStore` replaces it with the loaded
     user's id (`resolveActorConditions`), so `buildAbility`, `canRecord`,
     `conditionSql`, `accessibleBy` and the client rules all compare an integer, and SQL
     binds it as a parameter. Nothing is interpolated into SQL text.
   - `buildAbility` and `conditionSql` refuse an unresolved placeholder. Compared as
     text, `$ne` and inverted rules would otherwise match every record (fail open). Hosts
     that build actors themselves call `resolveActorConditions`. The administration
     guard resolves it per user too.
   - `RolesAdmin.setRule` accepts the placeholder only on `createdBy`, `updatedBy` and
     `user` fields, with `$eq`, `$ne` or `$in`. The role matrix marks those fields
     (`MatrixField.actor`), and the rule editor offers an «المستخدم الحالي» toggle for them.
   - Only the id is supported; other actor attributes are out of scope.
   - `canQueryField` is unchanged: any conditional rule on the resource, whatever its
     action, keeps sorting, filtering and search by field closed for that actor.

## Consequences

- The owner's rule becomes configuration: a resource with `inspector: { type: 'user' }`
  and a role with `view` plus `update` where `{ inspector: '$actor.id' }`.
- The rule applies to the resource that carries the user field. A child resource, such
  as visit answers, cannot yet condition on its parent's inspector. Until relation
  conditions exist, a child needs its own user field copied from the parent by a
  `beforeSave` hook; role rules are checked again after hooks run.
- An inspector with the conditional update rule cannot filter the list by `inspector`
  (the `canQueryField` rule above), so "my visits" cannot be a list filter for that role.
  Relaxing it to consider only `view` rules is a separate decision.
- `pnpm check:api` reports `Field`, `createResourceController`, `ResourceEditor` and
  `MatrixField` as changed: the `Field` union gains `{ type: 'user' }` and `MatrixField`
  gains an optional `actor`. Code that switches exhaustively over `Field['type']` must
  add the new case. `SettingScope` is reported only because TypeScript prints the same
  union in a different order. `ACTOR_ID` and `resolveActorConditions` are new exports.
- The copied `data-table`, `resource-field`, `resource-form` and `resource-value`
  components changed. Projects that customized them should merge the change with
  `adula:ui add --preview`. The starter role screen, a project-owned page, gained the toggle;
  existing projects can copy it from a new application.
- Test-only consumers (ADR 017): the `order_inspections` fixture resource runs the HTTP
  security contract and the conditional-policy HTTP test; the `ui_samples` fixture has a
  `reviewer` user field used by the browser test. Kit tests on PostgreSQL cover
  eligibility, serialization, filters, system writes, defaults, and the placeholder in
  CASL, SQL and inverted rules.
