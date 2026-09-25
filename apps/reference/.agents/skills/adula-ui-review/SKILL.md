---
name: ui-review
description: Review pages and components for RTL, the component system and data access.
---

Check, citing file and line:

- Components come from `inertia/components/ui` (installed by `node ace adula:ui add`);
  no `shadcn add` in modules, no hand-styled native controls or homemade dialogs.
- Forms and record details use the shadcn Dialog (ResourceSurface) unless the user
  asked otherwise; destructive actions confirm; edits guard against closing.
- RTL: `dir="rtl"`, logical properties (`ms-`, `ps-`, `text-start`), arrows follow
  the reading direction, Latin digits in amounts per the UI preference, Arabic
  labels and English identifiers. Dates honor the calendar preference.
- Generated pages are overridden only through `pages/<resource>/<mode>.tsx`.
- Heavy sections are deferred props or fetched after render; lists paginate with
  the scroll prop; no page renders data the server did not serialize for the user.
- Accessible names exist for icon buttons, dialogs and regions; errors use
  `role="alert"`; focus stays inside dialogs.
- Company identity from docs/design-identity.md is applied, not invented.

Verdict: accept, or findings with screenshots or selectors.
