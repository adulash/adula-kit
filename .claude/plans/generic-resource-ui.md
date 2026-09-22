# Generic resource UI (GAP-004)

Historical implementation note. Current scope/status is in docs/implementation-status.md and KIT_GAPS.md. ADR 017 keeps educational modules and page overrides under tests/fixtures only; this note does not authorize restoring them to the application.

## Server
- `ResourceService.lookups(name, actor)`: lookup labels for visible lookup fields (index/show/filters).
- `ResourceService.activity(name, id, actor)`: last 50 activities after authorizing `view`.
- `resources_controller.ts`: override resolution per resource/mode from `inertia/pages/<resource>/{index,form,show}.tsx` (fs at boot, Vite manifest fallback), generic index renders `result` as `inertia.scroll(...)`, show defers `childrenData` and `activity`.

## Registry components
- resource-value: formatting (money Arabic-locale, dates, lookup/belongsTo labels, attachment link) + `ResourceValue` component.
- resource-field: one control per kind (money, switch, calendar popover, datetime, json, attachment upload, lookup select, belongsTo combobox, inline hasMany table).
- resource-form: state, payload, error mapping (422 fields, 409 reload action, inline section errors), hidden version, document actions by permission.
- data-table: URL-driven sort/search/filters, Inertia InfiniteScroll (manual + scroll trigger), virtual rows above 200, CSV export, row actions with confirm.
- resource-actions: confirm dialog + transitions with version (shared by table and show).
- resource-show: ResourceValue cards, deferred children/activity with skeletons.
- resource-page: typed union props.

## Tests
- functional/resource_pages.spec.ts: all modes for customers/tasks/order_lines, scroll metadata, deferred props, override resolution, tasks 403 + navigation.
- browser/resources.spec.ts: generic pages end-to-end, 250-row virtualization, mobile, limited user, screenshots in `.work/screenshots/`.
- helpers/ui_fixtures.ts: runtime all-kinds sample resource for the control coverage.
