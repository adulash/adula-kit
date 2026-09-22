# ADR 003: Transactional persistence and at-least-once delivery

Status: accepted. Source: plan sections 2, 13 and 14.

Entity writes, inline inserts, activities, sequence increments and outbox rows commit in one transaction. Workers claim rows using FOR UPDATE SKIP LOCKED. Queue dispatch uses the event UUID as a stable ID. Delivery may repeat after a crash. Each listener records its deduplication key in the same transaction as its database effects.

External HTTP/email effects require provider-supported idempotency or a separate delivery outbox; a SQL transaction alone cannot make them exactly once. Only database listeners are implemented in the foundation.

Money is stored as bigint minor units and exposed as a decimal string to avoid JavaScript precision loss. Migrations are additive and snapshot the initial schema, never importing mutable resource definitions.
