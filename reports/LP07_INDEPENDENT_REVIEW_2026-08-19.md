# LP-07 Independent Review — 2026-08-19

- Reviewed commit: `c5ce9e3 feat: enforce storage and deterministic import entitlements`
- Reviewer role: independent, non-implementing reviewer
- Verdict: **APPROVED WITH CONDITIONS**
- Production access: review and probes were local/read-only; production was not written

The reviewer found no Critical or High issues. Security-definer ACLs, RLS, ownership, plan/user/mode
forgery resistance, advisory-lock concurrency, atomic rollback, cross-user idempotency and numeric
Free/Pro limits passed source review and local empirical probes.

## Conditions raised

1. **M1 — observe/warn were indistinguishable.** Neither mode persisted would-block storage events,
   and warn had no storage warning UI.
2. **M2 — storage mode had two sources.** Browser mutation paths read the database row while
   service-role paths accepted an environment-derived mode, allowing rollout drift.
3. **M3 — the 50,000-character validation can abort migration.** Production distributions must be
   queried read-only before applying LP-07.

Low findings: remove a revoke/grant no-op; explicitly document that legacy floors are fixed and do not
decay after deletion; retain PostgreSQL `char_length` as the final authority where JavaScript UTF-16
length differs for non-BMP characters.

## Required follow-up

- Persist bounded would-block observations for observe/warn and surface warn UI.
- Make `quota_runtime_settings.storage_enforcement_mode` the only storage enforcement source.
- Add a hardened aggregate-only production preflight for usage distributions and >50,000-character
  blockers.
- Add regression tests for GUC downgrade, direct RLS growth, service-role wrappers, hard length and
  fixed-floor refill behavior.
- Obtain a second independent review of the follow-up before enabling warn or block.

The initial review allowed only dedicated-staging migration/testing and an observe rollout. Warn,
block and production remain gated by the follow-up review, real-data preflight, verified backup/restore
and separate owner approval.
