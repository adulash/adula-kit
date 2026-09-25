---
name: perf-review
description: Review queries, pagination and background work against the performance budget.
---

Budget (plan section 13): list with two relations p95 < 300 ms, form save < 200 ms,
cached Ability build < 5 ms, on 100,000 seeded rows and 50 concurrent users.

Check, citing file and line:

- Lists go through `ResourceService.list`: keyset pagination, limit ≤ 100, selected
  columns only, belongsTo preloaded in one query per relation; no query in a loop.
- Custom queries have supporting indexes (foreign keys, `(org_unit_id, deleted_at)`,
  sort columns used by saved views); `EXPLAIN` shows no sequential scan on large
  tables for the common filters.
- Save paths keep one transaction: record, lines, activity, field changes and outbox.
  Anything slow (mail, HTTP, PDF, imports) runs in the worker, never inline.
- Listeners are idempotent and cheap or dispatch jobs; workflows do not poll.
- Caches (Ability, lookups, settings) are invalidated by the kit's revision rules,
  not by time alone.
- Run `pnpm test:medical` with `K6_BINARY` on staging-like hardware before release
  and record the measured p95 values; never relax the thresholds.

Verdict: accept, or findings with the measurement or query plan.
