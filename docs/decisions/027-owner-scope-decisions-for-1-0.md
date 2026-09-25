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
