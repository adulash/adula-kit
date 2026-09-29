# ADR 033 — Upload grants for one record field (1.1.0)

Date: 2026-09-29. Status: proposed; awaiting the owner's review in the pull request.

Issue #43. `POST /attachments` accepts a file only when the actor's role may create or
update the whole resource and the field. Some flows are authorized by module code for one
record: an inspector records the results of their own visit from a custom page and holds
no generic rights on the answers, because a generic `update` would let them edit every
inspector's answers. Such a user could not attach evidence, and re-implementing the upload
endpoint in the module would duplicate kit security code.

## Decisions

1. **`grantUpload(db, registry, { resource, recordId, field, userId, actorId, ttlMs })`.**
   Module code calls it after its own authorization. It names one attachment field of one
   existing record and one user, lives ten minutes by default and one hour at most, and
   returns a random 256-bit token. Only the token's SHA-256 hash is stored, in the
   `upload_grants` table (additive kit migration `1770000000014_kit_upload_grants`).
   A submitted or cancelled document refuses grants. Issuing one is recorded in the
   record's activity log (`upload_granted`, by `actorId`).
2. **The grant replaces the role rule of the upload, nothing else.** The host passes the
   token as `grant` with the upload; `redeemUploadGrant` returns the grant only while it is
   unexpired and held by the signed-in user. The upload then takes the grant's resource,
   field and organization unit, whatever the request names. File type and size
   (`attachmentPolicy`), the pending-upload limit, private unbound downloads and pruning
   apply as for any upload. The upload is recorded as `upload_via_grant`. A grant may be
   used several times until it expires; each upload counts toward the pending limit.
3. **A granted upload binds to the granted record only.** `registerUpload` marks it with
   the grant and ignores such a mark from any other caller. `claimAttachment` refuses to
   bind it to another record or to a record being created. Binding still happens in the
   module's own write (`systemSave` with the uploader as `actorId`), so ownership,
   organization unit and the activity log are checked as before.
4. Expired grants are removed by `pruneUploadGrants`, which the starter's upload pruning
   calls.

## Consequences

- `pnpm check:api` reports `UploadInput` as changed: it gains the optional `grant`. The
  other changes are additions.
- The starter `AttachmentsController` accepts `grant`; projects that copied it need the
  change to use grants. Without a `grant` the behavior is unchanged.
- Kit tests on PostgreSQL cover issuing, redemption by another user, expiry, the field
  and unit taken from the grant, forged marks and binding to another or a new record. The
  reference HTTP test uploads with a grant as a user without any role, and binds the file
  through `systemSave`.
