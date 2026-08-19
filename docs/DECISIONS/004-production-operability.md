# 004 — Production operability baseline

**Status:** Accepted — 2026-08-19

## Context

CapyStudy runs costly AI/import workflows, exposes public share links, and persists learning data. The production audit found no distributed abuse protection, tracing, alerting, recovery targets, or release environment separation.

## Decision

- Use managed Upstash Redis for distributed rate limiting, short-lived circuit-breaker state, and future bounded caches.
- Use Sentry for error tracking and distributed traces. Logs remain structured JSON and redact user content, credentials, tokens, emails and answers.
- Production requires `CAPYSTUDY_ENVIRONMENT=production`, Redis credentials, Sentry DSNs, and a protected health-check token.
- Staging is mandatory before production. Only the repository owner and CI/CD receive production deployment permissions; production credentials are never available to pull-request jobs.
- Public share links receive rate limiting. CAPTCHA is introduced only after an abuse signal, preserving normal sharing UX.
- Recovery targets are RPO <= 24 hours and RTO <= 4 hours. Restore drills run quarterly in an isolated Supabase project.

## Consequences

The app fails closed for rate-limited actions in production if managed Redis is missing. Local development continues without Redis, while staging must exercise the real integration.
