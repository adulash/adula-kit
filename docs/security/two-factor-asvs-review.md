# Two-factor authentication — ASVS review record

Status: **implementation self-assessed; human review deferred to 2.0 by the owner (ADR 027).** 2FA ships in 1.0 without an independent human security review. The plan (phase 3) and
the managed AGENTS rule 11 require a written human review of 2FA before acceptance.
This file is the checklist for that review. It does not claim the review happened.

Scope: `packages/kit/src/core/two_factor.ts`, the reference controllers
`two_factor_controller.ts` and `two_factor_challenge_controller.ts`, the login and
OAuth hand-off in `session_controller.ts` and `oauth_controller.ts`, and
`start/limiter.ts` (`twoFactorAccountLimiter`). Standard: OWASP ASVS 4.0.3, V2.8
(single- or multi-factor one-time verifiers) and related V2/V3 items.

| ASVS | Requirement (summary) | Implementation | Evidence |
|---|---|---|---|
| 2.8.1 | Time-based OTPs have a defined lifetime | 30 s period, ±1 step accepted (≤ 90 s) | `two_factor.spec.ts` stale code test |
| 2.8.2 | Symmetric keys protected (e.g. encrypted at rest) | Secret sealed with the app's AES-256-GCM encryption; never returned after enrollment | enrollment test checks the stored value |
| 2.8.3 | Approved cryptographic algorithms | RFC 6238 TOTP (HMAC-SHA1, as required for authenticator compatibility) via `otpauth` 9.5.2; 160-bit secret | `two_factor.ts` |
| 2.8.4 | A time-based OTP can be used only once in its validity period | `last_used_step` under a row lock rejects the same or an earlier step | replay tests (kit and HTTP) |
| 2.8.5 | Reuse of a TOTP is logged and notified | Failed second factors are logged (`two_factor_failed`); **no user notification yet** | gap — reviewer decision |
| 2.8.6 | Physical OTP generator revocation | Disable requires password and a current or recovery code; re-enrollment issues a new secret | disable test |
| 2.8.7 | Biometrics only as secondary factor | Not applicable | — |
| 2.2.1 | Anti-automation on authentication | Per-account penalty limiter: 5 failures / 15 min, blocking even valid codes; per-address throttle on the route | rate-limit test |
| 2.5.x | Recovery secrets | 10 single-use recovery codes (48 bits each), SHA-256 hashes at rest, compared in constant time, regenerated only with a current TOTP | recovery tests |
| 3.2.1 | New session token on authentication | Session regenerated when the password step succeeds; login only after the second factor | challenge test |
| 3.3.x | Partial authentication does not grant access | Pending state holds only the user id for 5 minutes; protected routes still redirect to login | challenge test |
| — | Alternative login paths | OAuth sign-in is routed through the same challenge | `oauth_controller.ts` |

Known limits for the reviewer:

- No QR code image is rendered (no approved QR dependency); users enter the key
  manually or open the `otpauth://` link on the phone.
- Recovery codes are shown once in the browser; the user must store them.
- Administrator impersonation does not require the target's second factor; it is
  restricted to administrators and recorded on every write (ADR 019 rules apply).
- Enforcement (making 2FA mandatory for administrators) is not implemented; it is
  a policy decision for the owner.

Human review: reviewer name, date and outcome to be recorded here.
