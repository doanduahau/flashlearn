# Production items deferred for cost review

Updated: 2026-08-19

The application can use free plans for the initial controlled beta where they
meet the stated reliability and access requirements. Do not enable a paid plan
or create a billable resource without owner approval.

## Can start on free plans

- Upstash Redis free tier for distributed rate limiting and circuit-breaker
  state. It is required before a production deployment because the application
  fails closed when Redis is unavailable.
- Sentry free tier for basic error tracking and alerting.
- Cloudflare Turnstile, if abuse telemetry later justifies a CAPTCHA on public
  share links.

## Requires cost or plan validation before public launch

1. **Database backup and recovery** — confirm that the selected Supabase plan
   provides an auditable daily recovery point that satisfies RPO <= 24h. If it
   does not, choose and approve either a paid Supabase backup capability or a
   daily encrypted owner-controlled export with at least 35-day retention.
2. **Restore-drill environment** — an isolated Supabase project is needed for
   the quarterly drill that demonstrates RTO <= 4h. Approve any usage beyond
   the free allowance before provisioning it.
3. **Production access controls** — verify that the selected Vercel/GitHub
   plans can restrict production deployment to the owner and CI/CD. Upgrade or
   adopt an approved deployment workflow if free-plan permissions cannot meet
   this requirement.
4. **Custom domain and branded email** — registering `capystudy` domain,
   transactional email, and any paid DNS/email service require separate owner
   approval. Until then, keep the hosted deployment URL and do not present the
   product as publicly launched.
5. **Sentry retention, quotas, and advanced alerts** — the free tier is enough
   for initial error tracking; evaluate a paid tier only when event volume,
   retention, or alert routing requires it.

## Deferred LP-05 production rollout

The LP-05 implementation is complete in code, but production provisioning and
the existing-user backfill remain disabled until all of the following exist:

1. **Independent review** — a reviewer other than the implementing agent must
   review the service-role RPC, RLS, concurrency, legacy floors and operator
   runner. Record findings and approval before any production write-mode run.
2. **Dedicated staging** — create separate `capystudy-staging` Supabase and
   Vercel Preview/Staging environments. Do not reuse unrelated inactive
   projects and do not point Preview at production data.
3. **Staging validation** — apply migrations, enable starter provisioning only
   on staging, run smoke/E2E and verify monitoring before production promotion.
4. **Production dry-run and capacity approval** — run the read-only backfill
   report against production, review eligible users, missing sets/cards,
   estimated growth and duration, then obtain explicit owner approval for the
   reported ceilings.
5. **Verified backup and restore drill** — production currently reports no
   managed backup snapshots and no PITR. Create an encrypted owner-controlled
   backup or approve a suitable managed plan, then restore it into an isolated
   project and verify RPO <= 24h and RTO <= 4h.
6. **Separate write-mode confirmation** — only after items 1–5 may the owner
   authorize `npm run backfill:starters -- --execute ...`. Keep the feature flag
   off and do not run write-mode automatically during deploy.

## Review trigger

Review this file before opening the product publicly, when any free-tier quota
is reached, or at the next quarterly recovery drill.

## Deferred LP-08 rollout

LP-08 AI/document/Typing enforcement is implemented and validated locally. Migrations
`20260820010000` and `20260820020000` have not been applied to staging or production. Before rollout:

1. Obtain an independent security and cost review of the implementation and migrations.
2. Apply to dedicated staging and run pgTAP, unit, document import, Paste/Sheets and Typing E2E.
3. Run a mock-provider staging load test for Free/Pro concurrency, crash TTL and stale reconciliation.
4. Configure and verify Gemini/Google Cloud spend limits or budget alerts plus Sentry operational alerts.
5. Observe real job distributions for at least seven days and obtain separate owner approval before
   changing quota enforcement from `observe` to `warn` or `block`, or enabling paid Pro/billing.

## Deferred LP-07 production enforcement

The LP-07 migration and application paths are implemented. Production was migrated through
`20260819220000` on 2026-08-20 after the hardened preflight passed, and remains observational. Do not
enable `warn` or `block` until all applicable items below are complete:

1. The first independent review of commit `c5ce9e3` is recorded in
   `reports/LP07_INDEPENDENT_REVIEW_2026-08-19.md`. Obtain a second independent review of the M1/M2/M3
   follow-up before enabling warn or block.
2. Record evidence that the LP-07 pgTAP, storage concurrency integration and relevant
   import/catalog/share E2E suites pass on the dedicated staging project. The existence and readiness of
   staging alone are not sufficient evidence for this gate.
3. Production preflight completed successfully on 2026-08-20 (maximum card-side length `81`; card sides
   above 50,000: `0`). Re-run it before any future migration or enforcement change that can alter these
   assumptions.
4. Keep `quota_runtime_settings.storage_enforcement_mode = 'observe'` for the sampling period, then
   change to `warn` only after the implemented warning UI/telemetry is verified on staging. Do not let the
   public client choose mode.
5. Obtain a separate owner approval before changing staging or production to `block`; retain the tested
   rollback procedure that changes the row back to `warn`/`observe` without deleting user data.
6. Complete the isolated restore drill and record measured RTO before treating the backup/restore gate as
   verified.
