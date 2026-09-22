# ADR 010 — MCP delegates to resource authorization

Status: accepted locally, 2026-09-18.

The optional `@adula/kit/mcp` entry exposes tool classes through `createResourceTools`. It uses the plan's `@jrmc/adonis-mcp` 2.0.0 package and requires the host to resolve an authenticated actor for each request. The factory delegates list, show, editor, save and lifecycle operations to ResourceService. It accepts no caller-supplied identity, role or organizational scope.

The reference application registers the official MCP provider, two thin tool exports, and `/mcp` with authentication and the package's protocol middleware. Because the current transport authenticates with browser sessions, Shield CSRF remains enabled. Cookie-authenticated clients must send a valid CSRF token. Future API-token support must use a separate authenticated configuration; disabling CSRF while retaining session authentication is not an upgrade path.

Input schemas describe the tools, while runtime checks reject unknown arguments and invalid identifiers. Resource validators and permission checks remain authoritative. Expected failures become MCP tool errors with status/code; unexpected errors do not expose SQL or stack traces. The adapter's peer dependency is optional so JSON-only consumers do not install MCP.

A submission also writes a workflow_runs envelope inside the record/activity/outbox transaction. Its ID matches the outbox event ID; `status=pending_definition` and `snapshot.kind=submission` explicitly distinguish it from a running XState machine. This supplies the phase 1 event consumer without pretending that the phase 4 workflow engine is implemented.

Evidence: HTTP tests cover discovery authentication, CSRF, all operation denials, field redaction, out-of-scope 404, rejected actor override, invalid fields, optimistic conflicts and submission records. PostgreSQL tests verify envelope rollback and non-duplication on repeated submission.
