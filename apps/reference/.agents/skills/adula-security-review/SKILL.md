---
name: security-review
description: Review authorization, serialization and sensitive flows of a change.
---

Check, citing file and line:

- Every route passes authentication and the resource goes through ResourceService
  (or `resources.access` for record features). Custom queries use `accessibleBy`;
  nothing reads records by id without the scope and Ability checks.
- Responses use the kit serializers; hidden and `permissionLevel` fields never leave
  the server, including through search, sort, filters, exports, prints, history,
  notifications, webhooks and OpenAPI.
- Role rules use only the six operators; nothing widens scope with an allow rule.
- No hand-written crypto, sessions, password or token handling. Secrets are sealed
  with the application encryption; tokens and recovery codes are stored hashed.
- Outgoing HTTP (webhooks, workflow steps) targets HTTPS and cannot reach private
  addresses in production; payloads carry identifiers, not record fields.
- Uploads and imports are size-limited and parsed by the kit; errors never echo
  secrets. Rate limits cover authentication, second factor and token creation.
- 2FA, impersonation and authentication changes are flagged for human review
  (AGENTS rule 11); map the change to ASVS 4.0.3 V2/V3/V4 items.

Verdict: accept, or blocking findings with the exploit scenario for each.
