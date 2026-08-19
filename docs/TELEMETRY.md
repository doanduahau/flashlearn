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

Correlation IDs connect stages inside an action now. LP-08 will preserve the same ID through asynchronous reservation/provider/job stages when those stages are introduced.

## Server-only rollout flags

| Environment variable                     | Default   | Use                                                                                       |
| ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `CAPYSTUDY_CATALOG_ENABLED`              | `false`   | Enables catalog routes/UI after staging validation.                                       |
| `CAPYSTUDY_STARTER_PROVISIONING_ENABLED` | `false`   | Enables account provisioning and the controlled backfill.                                 |
| `CAPYSTUDY_QUOTA_ENFORCEMENT_MODE`       | `observe` | `observe` logs only; `warn` adds UI messaging; only `block` can reject a heavy operation. |
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

The initial telemetry is intentionally not a first-party event table. LP-02/LP-08 may add durable quota/job records once their data model exists.
