# ADR 021 — OAuth is optional and does not block the base release

Date: 2026-09-21. Status: accepted by the owner.

The owner explicitly declined Google/GitHub sign-in for the current application after reviewing its purpose. Local email/password authentication and email recovery remain the supported, exercised sign-in path. A Gmail address can be used with the application's own password; this is not Google authentication.

Keep the existing optional Ally integration and its tests. Leave providers disabled when credentials are absent. Do not create OAuth applications, projects or secrets for the current setup. No real Google/GitHub sign-in success is claimed.

This decision amends the original plan's requirement for real OAuth acceptance: external OAuth verification is no longer a prerequisite for the base 1.0 release. If a consumer later enables a provider, verify its real callback and sign-in before claiming that provider works. SMTP delivery/recovery, authorization and all other acceptance gates remain unchanged.

The original plan and dated evidence remain historical records; current acceptance and readiness documents apply this amendment. OAuth omission does not mark any incomplete phase accepted or authorize merging or publication.
