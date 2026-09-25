# ADR 027 — Owner scope decisions for 1.0

Date: 2026-09-25. Status: decided by the owner in conversation.

## Decisions

The owner stated in conversation (Arabic):

> التطبيق الذي يعمل في الإنتاج يكون بعد الإصدار V1 ويتم عمل ذلك من طرف المستخدم.
> مراجعة 2FA تؤجل الى الإصدار V2.
> تؤجل نتيجة الجدولة الشهرية الى V2.

1. **Production consumer.** 1.0 does not require an application operated in
   production. Users build and operate production applications on the published
   1.0. This confirms ADR 024 for the plan's phase 7 condition ("one consumer in
   production") and answers the open question in ADR 026.
2. **2FA human review deferred to 2.0.** Two-factor authentication ships in 1.0
   implemented and tested, with the ASVS checklist in
   `docs/security/two-factor-asvs-review.md` still unsigned. The review becomes a
   2.0 requirement.
3. **Natural monthly schedule deferred to 2.0.** The observed, unaccelerated
   monthly `backup:restore-test` run is not a 1.0 gate. The accelerated timer
   evidence and the command itself remain tested in 1.0.

## Consequences

- Release notes and docs state plainly that 2FA has **not** had an independent
  human security review. Managed AGENTS rule 11 is unchanged: any change to 2FA
  or impersonation still needs a human review, and the deferred review is due
  before 2.0.
- The 2.0 list gains: 2FA ASVS review (including the 2.8.5 notification gap),
  the natural monthly restore-test observation, and an operated production
  consumer's feedback.
- These decisions do not accept any phase. Phase acceptance, council 2 (ADR 026),
  the remaining phase 0 and 1 items not deferred here, and the authorization to
  publish 1.0.0 remain separate owner decisions.

## Amendment, 2026-09-25: 2FA is not part of 1.0

The owner then stated: "دعم 2FA سيكون في الإصدار 2 ولن يدعم في هذا الإصدار"
(2FA support will come in version 2 and is not supported in this release).

Two-factor authentication is therefore removed from 1.0 instead of shipping
unreviewed. Commit f7c68b6 was reverted: the `TwoFactor` service and export, the
unreleased `1770000000009_kit_two_factor` migration (never published, so removing
it breaks no installation), the `otpauth` dependency, the reference routes,
controllers, pages and tests. The tests that f7c68b6 also adjusted for framework
listeners were kept. The implementation stays in Git history for 2.0, where it
returns with the human ASVS review. A later 2.0 migration must use a new name.

Branch protection on `main` was confirmed on 2026-09-25: the owner referred to a
screenshot of the repository's branch protection rule 83547320 (a local file this
session could not open), and the GitHub API reports `main` as protected. The
rule's individual settings were last recorded in
`docs/evidence/alpha-publication-2026-09-23.json`.
