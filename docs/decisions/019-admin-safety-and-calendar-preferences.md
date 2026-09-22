# ADR 019: administrative access safety and business UI preferences

Status: accepted implementation direction, 2026-09-19. This does not accept a release gate.

## Context

The first creator consumer reported disconnected Arabic terminal text, a missing bootstrap grant, immediate permission mutations, inconsistent dialog dismissal and ambiguous operational navigation. The owner requested Gregorian, Hijri, and both-calendar display modes; English terminal instructions with visual progress were explicitly selected.

## Decisions

- The creator uses English prompts, errors and six real progress stages. TTY output uses restrained color and a spinner; redirected output, `NO_COLOR` and dumb terminals remain plain. Child output stays in the application's ignored private `tmp/install.log`. Application labels and validation remain Arabic. No password is printed by the creator.
- Access-changing role/user operations take the installation advisory transaction lock, compare active administrators through the same CASL decision as the admin middleware, and reject removing the last active administrator or the acting administrator's own management access. Deny rules, role assignments, disabled accounts and scoped roles participate in the decision. Rejection rolls back the mutation, activity and authorization revision. The invariant is always active; a UI preference cannot disable it.
- Repeating `adula:install` repairs a missing unconditioned bootstrap grant even when `administrator` already exists. It does not delete custom rules or suppress explicit denies. The role name stays stable for this recovery path. The observed empty grant is reproducible; an interrupted transaction is not established as its cause.
- Permission changes and role removal require a shadcn confirmation, with distinct edit/details and delete actions. The workspace displays server success/error flashes, including rejected administrative changes.
- `ui.preferences` is a validated system setting: `calendar` is `gregory`, `islamic-umalqura` or `both`; `confirmDialogClose` and `pageTransitions` are booleans, both enabled by default. Gregorian is the default calendar. The settings page offers normal labeled controls, with technical settings retained separately.
- Date storage and API contracts remain Gregorian ISO dates / ISO timestamps. Hijri input uses Umm al-Qura, through `Intl.DateTimeFormat` and exact inverse lookup, with supported input years 1300–1600 AH. Impossible days are rejected. Arabic and Persian digits are accepted. Both mode renders both calendar representations and offers a per-field input-calendar switch with the corresponding date visible. Tables, CSV, details and administrative timestamps use the same preference; date filters submit the canonical date.
- View dialogs dismiss directly on outside click, close and Escape. Edit dialogs ask before dismissal by default, including unchanged forms; cancellation keeps input. Custom editors use `mode="edit"`, details use `mode="view"`, confirmations use `mode="confirm"`. Automatic form detection covers existing dialogs. Saving and successful navigation do not prompt. A user-requested full-page surface remains supported.
- The workspace persists across authenticated navigation; short content transitions respect reduced motion and the application preference. Operational navigation is named `تشغيل النظام` (system operations).

## References and verification

The calendar identifier is defined in [Unicode CLDR calendar types](https://github.com/unicode-org/cldr/blob/main/common/bcp47/calendar.xml); [MDN Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) supplies a known Gregorian/Hijri conversion used as a test vector. No approximate lunar arithmetic or extra calendar dependency is introduced.

Regression coverage includes PostgreSQL administrative rollback/concurrency, packed-consumer bootstrap repair, preference persistence/validation, calendar roundtrips and invalid dates, plain/TTY installer progress, and real browser confirmation and dual-calendar flows. Actual run results belong in implementation-status and evidence; this decision alone is not test evidence.
