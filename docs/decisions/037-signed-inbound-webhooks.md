# ADR 037 — Signed inbound webhooks (1.2.0)

Date: 2026-09-29. Status: proposed; awaiting the owner's review in the pull request.

Issue #30. Applications need to react to external systems (for example a Git host
linking pull requests to tasks). The kit had outgoing webhooks only, so each consumer
would write its own public endpoint, signature check and retry handling.

## Decisions

1. Administrators manage inbound sources at `/admin/webhooks`: a key used in the path, a
   name, the HMAC algorithm (SHA-256 or SHA-512) and header names that default to
   GitHub's. The secret is generated, sealed with the same secret box as outgoing
   webhooks, shown once and rotatable (rotation stops the old secret at once).
   `InboundWebhooks` in the kit holds the logic; additive migration
   `1770000000015_kit_inbound_webhooks` adds `inbound_sources` and `inbound_deliveries`.
2. Senders post to `POST /webhooks/in/<key>`. The route has no session or CSRF check. It
   is limited to 300 requests per minute per source and address, and 600 per minute per
   address across all sources, so rotating the key in the path does not avoid the limit.
   The kit verifies the HMAC over the raw body in constant time before storing anything;
   bodies over 1 MB, unknown or inactive sources, bad signatures and non-JSON bodies are
   refused. A form-encoded delivery (GitHub's default content type) gets 415 with the
   instruction to choose `application/json`; the secret dialog says so too.
3. Each delivery is stored once per source by the sender's delivery id (or the body hash
   when the sender sends none) and raised through the outbox as `inbound.<key>.<event>`
   with `{ source, delivery, event, body }`. Module listeners react idempotently with the
   outbox's retries and history. The delivery log can raise a stored delivery again.
4. **Replay of a signed body.** Senders such as GitHub sign the body only, not the
   delivery id or the event header. A captured request could therefore be replayed with a
   new delivery id or another event name. Each source refuses a body it has already
   received (`dedupeBody`, on by default; unique `(source_id, body_key)`). GitHub
   redeliveries reuse their delivery id, so they are unaffected. An administrator may turn
   the option off for a sender that repeats identical bodies for distinct events; that
   source then relies on idempotent listeners. There is no timestamp freshness check,
   because GitHub signs none.
5. Updating a source changes only the fields given; the others keep their stored values.
   A new algorithm without a new prefix keeps a default prefix in step with it.
6. Stored deliveries are kept for 90 days (`INBOUND_RETENTION_DAYS`). The starter's
   scheduler calls `InboundWebhooks.pruneDeliveries()` daily.

## Consequences and limits

- Listeners must still be idempotent on the business effect: deduplication is per source
  and ends when a delivery is pruned after 90 days.
- Projects need the starter's route with both limiters, `inbound_webhooks_controller.ts`,
  the `inbound` member in `app/services/kit.ts`, the inbound handlers in
  `admin/webhooks_controller.ts`, the shield exception for `/webhooks/in/`, the scheduler
  entry and the admin webhooks page to expose it.
- Kit tests on PostgreSQL cover signing, forged/unsigned/unknown/oversized/malformed and
  form-encoded requests, deduplication by delivery id and by body (including a replay under
  another event name), turning body deduplication off, partial updates, retention, dispatch
  to a listener and redispatch; reference tests cover the HTTP route and the
  administration screen.
