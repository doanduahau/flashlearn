# Operations runbook

## Ownership and escalation

The production owner is responsible for Vercel, Supabase, Upstash, Sentry and Google Cloud access. CI/CD uses a least-privilege deployment token; contributors use preview/staging only.

## Monitoring

- Poll `GET /api/health` for liveness.
- Poll `GET /api/health/ready` with `Authorization: Bearer $HEALTHCHECK_TOKEN` for dependency readiness.
- Alert on health/readiness failure, Sentry new issue or error-rate spike, Gemini/Google Sheets failure spike, circuit breaker opening, and rate-limit spikes.
- Inspect structured events in Sentry by `event`, `service`, environment and trace.
- Use the fixed event taxonomy and baseline queries in `docs/TELEMETRY.md`; never search for or export raw learning content while investigating an incident.

## Incident response

1. Acknowledge the alert and record the start time, impact and affected environment.
2. Check Sentry trace/errors, readiness probe, Vercel deployment status, Supabase status and Upstash availability. Never paste secrets or flashcard content into an incident channel.
3. For Gemini/Google outage, the circuit breaker limits repeated calls; advise users to retry later and preserve deterministic imports.
4. For abuse, inspect aggregate rate-limit events, tighten the affected policy, and enable CAPTCHA only for the affected public-share path.
5. For a bad application release, roll back in Vercel first. Do not roll back database migrations blindly; use the documented forward migration or restore procedure.
6. Record cause, mitigation, user impact and corrective action after recovery.

## Release procedure

1. Merge only after CI passes. Deploy the exact commit to staging with separate Supabase/Redis/Sentry projects and secrets.
2. Run `npm run smoke:staging`, verify Sentry events, health probes and no mock/test environment flags.
3. Keep new CapyStudy feature flags disabled by default; enable one flag in staging, review the matching telemetry for seven days where practical, then promote the same configuration through CI/CD.
4. Promote the same commit to production through CI/CD. The owner verifies the post-deploy smoke matrix in `DEPLOYMENT.md`.
5. Roll back Vercel immediately when smoke checks fail. Stop and investigate if migration state differs from the expected head.
