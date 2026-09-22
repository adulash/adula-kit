# ADR 015: Generic resource pages, keyset scrolling and page overrides

Status: implemented locally 2026-09-18; visual review of the saved screenshots and the k6 budget remain open (GAP-004).

## Context

Plan section 9 requires a generated `index`/`show`/`create`/`edit` per resource after the hand-built order pages, with keyset paging through `inertia.scroll`, virtual rows above 200, deferred heavy sections and a file-based override rule. The first generic components rendered every kind as a text input, appended pages through a private axios loop and hid inline rows.

## Decisions

**Payload shape.** The discriminated `view` prop stays nested (`{ mode, resource | editor, ... }`) because Inertia page typing applies `Omit` to top-level props and flattens unions. The index list is a separate top-level `result` prop built with `inertia.scroll(result, provider).matchOn('id')` where the provider reports `pageName: 'cursor'` and the service's `meta.nextCursor`. `@adonisjs/inertia` labels only `result.data` for merging, so the copied `data-table` accumulates `permissions` and `related` across pages itself instead of changing the `ResourceList` contract. Sorting, searching and filtering are full visits driven by the URL; loading more is a partial reload issued by Inertia's `InfiniteScroll` in manual mode (`preserveUrl`, `limit=100`), triggered by a button and by scrolling near the end of the table.

**Field controls.** `resource-field` maps every kind of `Field` to one control and shares parsing with `resource-value`: money is edited as decimals with Arabic or Latin digits and sent as minor-unit strings; dates are typed as `YYYY-MM-DD` with a calendar popover; attachments upload on selection to `POST /attachments` and the record stores the returned id; belongsTo searches the authorized options route with a debounce and keyset "more"; inline hasMany rows travel as arrays with `id`, `version` and `_delete` markers. Nested validators report a child field without its row, so inline `422` errors surface on the section while client-side checks run per row first.

**Show page.** `childrenData` and a new `activity` prop are deferred in separate groups; `ResourceService.activity()` re-authorizes `view` on the record before returning the last 50 activities. `ResourceService.lookups()` supplies lookup labels for cells, cards and filters; `describe()` stays synchronous.

**Override rule.** `apps/reference/app/controllers/resources_controller.ts` scans `inertia/pages/<resource>/{index,form,show}.tsx` once at boot (the Vite manifest in production builds, where sources are absent) and renders that page instead of `resources/page` for the matching resource and mode. There is no setting and no hook. The order pages predate the generic payload and keep their own props; every other override receives the generic props. Orders therefore keep `orders/index` and `orders/form` while their show page is generic.

## Consequences

Generic browser acceptance now covers customers, tasks and an all-kinds sample resource registered by the test helper (`tests/helpers/ui_fixtures.ts`), including 250 virtualized rows, CSV export, mobile viewport and a viewer without write permissions. Server-side filter ranges are not implemented: `list()` compares filters for equality, so the date filter applies one day. Attachment uploads in the browser suite run only when the `/attachments` route exists. The k6 workload, saved views and the fixed admin screens are outside this decision.
