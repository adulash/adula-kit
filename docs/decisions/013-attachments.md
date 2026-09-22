# ADR 013: Attachments, ownership, private disks, storage moves and the restore drill

Status: accepted 2026-09-18. Implements the plan's attachment row (section 2), the `adula:storage:migrate` command (section 10) and the monthly restore test (section 16).

## Decision

One kit table, `attachments`, records every stored file: `disk`, `path` (relative to the disk root, always slash-separated), the original and stored names, size, MIME type, the full `@jrmc/adonis-attachment` attributes as JSON for rehydration, the uploader, an optional organization unit and the binding (`resource`, `record_id`, `field`). Resource fields of type `attachment` become integer columns referencing `attachments(id)` with `RESTRICT`.

The kit stays framework-agnostic: it validates and stores metadata (`registerUpload`), decides ownership inside the record transaction (`claimAttachment`, `releaseAttachment`) and hydrates reads into `{ id, name, size, mimeType, url }` with one query per page. The host performs Drive I/O: the reference `POST /attachments` route stores the multipart file through the attachment manager under `resources/<resource>/<field>/<uuid>.<ext>` on the configured default disk, and `GET /attachments/:id` streams it with an RFC 5987 `Content-Disposition` so Arabic names survive.

Ownership rules: a record write may bind only an upload made by the acting user that is unbound, or already bound to that same record field. Uploads registered for another resource or field, another organization unit, deleted rows and unknown ids are rejected with `E_ATTACHMENT` and roll the whole write back. Replacing or clearing a field soft-deletes the previous row; files are never deleted by these paths so a restore can still open them.

Downloads follow the record: a bound file is served only when `ResourceService.show` returns that field to the actor (scope, ability and field permission all apply); an unbound upload is served only to its uploader. Every failure is a 404 so foreign ids leak nothing. All disks are private; Drive never serves files itself.

`adula:storage:migrate <from> <to>` copies every live file to the target disk, verifies the stored size and repoints each row in its own statement, so an interrupted run resumes and a repeated run is idempotent. Source files are not deleted; the doctor already warns before local copies should be removed. Unknown disks are refused and `--dry-run` lists the work without touching anything.

`backup:restore-test` (scheduled monthly, `withoutOverlapping`) takes the latest complete snapshot, verifies `SHA256SUMS`, restores `database.dump` into `<DB_DATABASE>_restore_<stamp>`, extracts `uploads.tar.gz`, counts every resource table, picks the newest bound attachment on the archived local disk, asserts the file exists with the recorded size, and only then writes `settings.backup.lastRestoreTest` (ISO timestamp, what doctor reads) plus `backup.lastRestoreTestReport` (the summary). A failed drill records the failure in the report, exits non-zero and leaves the last success untouched. The temporary database and folder are always dropped.

## Consequences

Uploads that are never bound stay on disk as unbound rows; doctor reports their count and age as information rather than deleting them. Attachments stored on the S3 disk are not in `uploads.tar.gz`, so the drill verifies local files only; an S3 deployment needs its own object check. The multipart limit stays 20 MB, and file types are not restricted beyond the sanitized extension.
