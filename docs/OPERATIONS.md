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

## Starter provisioning rollout and backfill

Starter provisioning runs after an authenticated app render only when
`CAPYSTUDY_STARTER_PROVISIONING_ENABLED=true`. It is best-effort and never runs in the Auth trigger,
so a catalog outage cannot break signup or login. Roll out on staging first with test accounts.

The existing-account runner is read-only by default:

```bash
npm run backfill:starters
```

Its report includes eligible users, already-complete users, estimated sets/cards, estimated database
growth and duration. It prints user UUIDs only for failed write attempts and never prints email or card
content. Review the dry-run against approved Supabase capacity before any execution.

Execution requires explicit confirmation, capacity ceilings and a checkpoint inside the workspace:

```bash
npm run backfill:starters -- --execute --confirm BACKFILL_STARTERS --checkpoint reports/starter-backfill.checkpoint.json --max-new-sets 300 --max-new-cards 15000
```

For production, also pass `--backup-verified-at <ISO timestamp>`. The timestamp must represent a
verified backup no older than 24 hours. Use `--resume` with the same checkpoint after interruption.
The runner advances its `(created_at, user_id)` cursor only after a durable batch and limits batch size
to 100 and concurrency to 5. Stop if the capacity gate is reached; do not raise it without a new review.

Rollback is `CAPYSTUDY_STARTER_PROVISIONING_ENABLED=false` and stopping the runner. Never delete
already-created user sets automatically. A completed state remains completed after the user deletes a
starter set, so ordinary app loads respect that choice.
