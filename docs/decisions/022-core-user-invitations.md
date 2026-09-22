# ADR 022: Core user invitations

Status: implemented on 2026-09-21; validation is recorded in implementation-status.md.

User invitations are a foundation feature shipped in the kit and the standalone creator. The kit owns an additive user_invitations migration and the UserInvitations service. The creator copies the reference controller, mail, routes and project-owned shadcn Dialog pages on first installation. Existing application-owned pages are not overwritten by package upgrades.

The central core.users/invite permission is configurable in the roles matrix. Administrators inherit it through manage/all; explicit denies still apply. Fresh database-backed CASL checks protect the service and HTTP endpoints, while shared navigation exposes only authorized entry points. Organizationally scoped roles cannot invite deployment-wide users. Invitation authority does not grant access to user administration, role assignment or impersonation.

Pending invitations are not accounts. A normalized email receives a random 256-bit bearer token whose SHA-256 digest alone is stored. Links expire after 24 hours, are single-use and are replaced by resends after a one-minute cooldown. Acceptance takes an email advisory lock and a row lock, creates the account with the host's configured Adonis password hasher, consumes the token and audits the result in one PostgreSQL transaction. No password is mailed; no roles or memberships come from invitation requests. Existing accounts, including disabled accounts, are never modified by this flow.

SMTP delivery is synchronous and audited separately from the database commit. Transport failure revokes that attempt and returns a retryable error, without deleting a newer resend. SMTP acknowledgment is not inbox receipt; exactly-once external delivery is not claimed. A crash after commit but before acknowledgment can be recovered by resending after the cooldown. The host must configure SMTP and a trusted APP_URL. Live external delivery requires an explicitly selected recipient; automated tests use a loopback SMTP server.
