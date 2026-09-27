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
2. Senders post to `POST /webhooks/in/<key>`. The route has no session or CSRF check and
   a limit of 300 requests per minute per source and address. The kit verifies the HMAC
   over the raw body in constant time before storing anything; bodies over 1 MB, unknown
   or inactive sources, bad signatures and non-JSON bodies are refused.
3. Each delivery is stored once per source by the sender's delivery id (or the body
   hash when the sender sends none) and raised through the outbox as
   `inbound.<key>.<event>` with `{ source, delivery, event, body }`. Module listeners
   react idempotently with the outbox's retries and history. The delivery log can raise
   a stored delivery again.

## Consequences and limits

- Senders such as GitHub sign the body only, not the delivery id or a timestamp. A
  captured request replayed with a new delivery id is accepted again; listeners must be
  idempotent on the business effect, and secrets must be rotated if leaked.
- Projects need the starter's routes, `inbound_webhooks_controller.ts`, the limiter entry,
  the shield exception for `/webhooks/in/` and the admin webhooks page to expose it.
- Kit tests on PostgreSQL cover signing, forged/unsigned/unknown/oversized/malformed
  requests, deduplication, dispatch to a listener and redispatch; reference tests cover
  the HTTP route and the administration screen.
