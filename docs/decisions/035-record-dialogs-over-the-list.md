# ADR 035 — Record dialogs over the mounted list (1.2.0)

Date: 2026-09-29. Status: proposed; awaiting the owner's review in the pull request.

Issue #31. Records open in a shadcn Dialog (AGENTS rule), but the dialog was a separate
Inertia page: opening a record replaced the list, and closing it returned to a freshly
loaded list. 1.0.1 restored the list's query, scroll and focus on close; the list was
still unmounted and reloaded, and an edit that was saved left the dialog.

## Decisions

1. From the generic list, the view and edit links call `openRecord(resource, id, mode)`,
   exported by the registry's `resource-surface`. It reads the record once from
   `GET /resources/:resource/:id/view` and pushes a client-side Inertia visit with the
   record URL. The list stays mounted with its query, loaded pages and scroll.
2. Closing replaces the history entry with the list, refreshes its rows only when the
   record changed, and returns focus to the row link.
3. Saving an edit turns the dialog into the record's details, over the list and on a
   direct edit URL.
4. A direct record URL still renders the standalone dialog. Its inline children and
   activity arrive in one deferred request served by `ResourceService.details()` from a
   single authorized record read; `ResourceService.record()` returns show, children and
   activity together for the `/view` endpoint.
5. Resources with their own page overrides keep navigating to their pages.

## Consequences

- Projects with copied `data-table`, `resource-form`, `resource-page` or `resource-show`
  need the updated components; `resource-surface` is new in the registry.
- The frontend design skill tells agents to open records with `openRecord` from lists.
- `record()` and `details()` apply the same authorization as `show()`, `children()` and
  `activity()`; kit tests cover both on PostgreSQL, and the reference browser test checks
  that the list keeps its state.
