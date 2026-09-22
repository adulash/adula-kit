# ADR 014: Fixed core administration screens

Status: implemented locally 2026-09-18; operational gates stay in KIT_GAPS.md.

The plan's section 9 requires a fixed set of core screens: users, roles, organizational tree, activity, sessions, jobs, settings, notifications and a backup warning bar. They are built once from the registry and must not change when a resource is added.

The administration logic lives in the kit (`packages/kit/src/core/`) as knex services: `UsersAdmin`, `RolesAdmin`, `OrgUnitsAdmin`, `ActivityAdmin`, `SettingsAdmin`, `NotificationsAdmin` plus `runtimeHealth`/`isBackupStale` and the shared `logActivity`. Every mutation writes an activity row inside its transaction, so administration is audited exactly like resource writes. The reference application owns only the HTTP and Inertia layers (`app/controllers/admin/`, `inertia/pages/admin/`), because those are project-owned files and because queue introspection belongs to the application's BullMQ adapter, not to the kit.

The roles screen writes `role_rules` rows directly — the CASL shape the evaluator already consumes — from a resources × actions matrix derived from the registry. Conditions pass through the kit's existing condition compiler before they are stored, so an operator cannot save a predicate the SQL translator would reject at request time; JSON, attachment and hasMany fields stay unsupported and are refused rather than silently ignored. Field whitelists are validated against the resource's own field keys.

Authorization for the whole area is one `admin` middleware: the actor's ability must `manage` `all`. It answers JSON with 403 and HTML with a rendered Arabic page, so the route scan can assert both. Administration never bypasses the authorization revision: the existing database triggers bump it, so removing a rule drops the target user's navigation on their next request without any cache plumbing in these controllers.

Impersonation keeps the administrator's identity in the session under a separate key and logs both the start and the end. Because an impersonated user browses the whole application, the banner is mounted in every layout, not only the workspace shell — a page that forgets it would hide the fact that the session is borrowed.

Deleting an organizational unit is refused while it has children, memberships or scoped records in any registered resource; moving one goes through `moveOrgUnit` so descendant paths and therefore every scope follow in one transaction. Operational settings (`scheduler.heartbeat`, `backup.*`) are readable but not editable from the settings screen: they are written by the scheduler and backup pipeline, and an operator editing them would falsify the very signals doctor and `/health` report.
