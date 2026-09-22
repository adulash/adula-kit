# ADR 008: Explicit inline mutations and parent authority

Status: implemented locally.

Inline arrays contain only intended changes: a row without `id` inserts, a row with `id` updates, and `{ id, version, _delete: true }` requests soft deletion. Omitted records remain untouched, so pagination and row-level authorization cannot implicitly delete unseen children. Duplicate identifiers and identifiers belonging to another parent are rejected. Each child passes its own validator, field policy, organization scope and version check.

The parent, children, sequences, activity and outbox share one transaction. Any stale child or failed policy rolls back every write. A child cannot move to another parent. A parent with live inline rows cannot move organizational units through ordinary CRUD. Independent child endpoints require parent update authority and a draft parent; newly inserted children in a parent creation transaction use that already-authorized creation context.

The reference order-line resource enables optimistic locking using an additive migration. Tests cover rollback, foreign-child injection, duplicate IDs, reparenting, organization moves, submitted-parent bypass and create-only parent permissions. A browser test changes a line quantity and verifies its persisted version increment.
