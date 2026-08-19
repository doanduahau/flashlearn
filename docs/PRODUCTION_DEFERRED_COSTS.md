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

## Review trigger

Review this file before opening the product publicly, when any free-tier quota
is reached, or at the next quarterly recovery drill.
