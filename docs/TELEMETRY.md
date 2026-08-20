# Telemetry and staged rollout

## Safety boundary

Telemetry is observational. A failed log or Sentry breadcrumb never rejects an action, consumes quota, or changes user-visible behavior. Events use a fixed schema with a generated correlation ID, low-cardinality enum values, and size/count buckets. Never put raw flashcard/document content, filenames, email addresses, URLs, tokens, API keys, or raw provider errors into an event.

## Event taxonomy

| Event                          | When                                                                     | Safe dimensions                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `capystudy.import.processed`   | Paste, workbook, Google Sheets, or document import is completed/rejected | source, outcome, deterministic/AI path, size and output buckets, correlation ID |
| `capystudy.document.processed` | Document extraction, classification, or card generation completes        | operation, outcome, processing path, size/output buckets, correlation ID        |
| `capystudy.rate_limit.decided` | A rate-limit check resolves                                              | policy, allowed/limited/unavailable, retry bucket, correlation ID               |
| `capystudy.quota.decided`      | Future entitlement code evaluates a quota                                | resource, observe/warn/block mode, decision, correlation ID                     |
| `capystudy.provisioning.*`     | LP-05 creates or verifies starter sets                                   | result code, set count bucket, correlation ID                                   |
| `capystudy.catalog.*`          | LP-06 lists or installs catalog content                                  | result code, category/level, set count bucket, correlation ID                   |
| `capystudy.typing_ai.*`        | LP-08 uses AI feedback                                                   | result code, usage bucket, correlation ID                                       |

Correlation IDs connect reservation, provider and durable job stages. LP-08 stores plan/source, input
characters, physical calls, provider input/output tokens, output count, heartbeat and sanitized error
codes in `processing_jobs`; raw prompts, responses, filenames and card/document content are never stored
there or attached to Sentry.

## Server-only rollout flags

| Environment variable                     | Default   | Use                                                                                       |
| ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `CAPYSTUDY_CATALOG_ENABLED`              | `false`   | Enables catalog routes/UI after staging validation.                                       |
| `CAPYSTUDY_STARTER_PROVISIONING_ENABLED` | `false`   | Enables account provisioning and the controlled backfill.                                 |
| `CAPYSTUDY_QUOTA_ENFORCEMENT_MODE`       | `observe` | Controls non-storage usage reservations. Storage uses the service-role-only database row. |
| `CAPYSTUDY_ADMIN_CONSOLE_ENABLED`        | `false`   | Enables the internal admin console after role/RLS validation.                             |
| `CAPYSTUDY_BILLING_ENABLED`              | `false`   | Enables provider checkout/webhooks only after LP-13.                                      |

Do not expose these as `NEXT_PUBLIC_*` variables. Set them independently in staging and production. Turn on one flag at a time and leave quota in `observe` until measurements show that the proposed limits fit real usage.

## Baseline queries

Run `npm run baseline:usage` only with local or staging credentials. The script explicitly refuses a production runtime, uses read-only Supabase selects, and prints aggregate users, sets-per-user, and cards-per-user distributions. It never prints user identifiers or content. The script samples at most 10,000 rows per distribution and marks a distribution as truncated when its count is larger.

For each staging rollout, inspect Sentry/structured logs over at least seven days:

1. Count `capystudy.import.processed` by source, outcome, and processing path.
2. Count `capystudy.document.processed` by operation/outcome; compare AI and deterministic paths.
3. Track `capystudy.rate_limit.decided` limited/unavailable ratios by policy.
4. Before moving quota from `observe`, estimate monthly resource use from the event buckets and compare it with provider cost and error rate.

Storage quota rollout uses the bounded first-party `storage_quota_observations` table for would-block
events. Other application telemetry remains external/structured. LP-08 durable job records are the source
for heavy-job reconciliation and cost distributions; Redis leases are never the source of truth.
