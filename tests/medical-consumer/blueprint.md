# Medical-assets acceptance slice

Approved-plan consumer, phase 2; not the full phase 6 production application.
The kit's idea-review was applied before implementation. All application files
are installed into a separate application under `.work`, with its own package
lock, PostgreSQL databases, cache namespace and copied UI. No domain is registered
in apps/reference. The owner confirmed this is a disposable kit test and does not
need company branding. Reuse the existing kit theme; keep customizations only to
exercise project ownership and later upgrade preservation.

| Resource | Ownership/scope | Relations and visibility |
|---|---|---|
| equipment_categories | medical module, central | Shared catalog; name required |
| equipment_locations | medical module, organizational | Name required; isolated by org tree |
| medical_assets | medical module, organizational | Category and location; unique asset identifier; acquisition cost level 1; date; bound manual attachment |
| asset_components | medical module, organizational | Inline children of an asset; name/quantity; optimistic version; same parent scope |

Use public defineResource, generated resource scaffolds, additive initial schema
snapshots, ResourceService, ActorStore, installed UI and operational backup commands.
No custom auth, database shortcuts in HTTP authorization, installed package patches
or newly invented framework extension is required. Existing CRUD events/outbox and
activities supply audit history; no custom workflow or event subscriber is needed.

Implemented-now scope: CRUD, preload, scope and field permissions, inline atomicity,
attachment upload/download, real browser login and Dialog surfaces. Declared extension:
project-owned list override and copied component customization, preserved by hashes.
Outside this slice: clinical/patient data, medical advice, procurement, depreciation,
maintenance workflows and phase 3–7 features. They are not inferred from asset tracking.

Acceptance: real PostgreSQL/HTTP tests for authorized creation, persisted children,
foreign-scope relation rejection, 403/404 isolation, hidden cost, conflict/rollback,
file-byte equality and denied download; production build; independent package resolution;
local database-plus-file restore; 100000 representative rows/50 distinct users for
performance, plus cached actor/Ability timing and invalidation. Local evidence stays
separate from staging, published-version upgrade and human UI review. Those gates
remain pending until actually performed.
