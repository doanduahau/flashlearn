# Reliability, performance and scale controls

## External dependencies

- Google Sheets requests have a 10-second deadline; browser public-sheet calls are serialized with a 500ms minimum interval.
- Gemini requests have a 10-second deadline, retain the intentional single provider attempt, and open a distributed circuit after five failures within one minute. The circuit remains open for one minute.
- Supabase mutations remain idempotent at their existing RPC boundaries. New RPC work must define a timeout, idempotency behaviour and retry policy.

## Capacity and retention

Supabase JS uses the HTTP data API, not a long-lived direct PostgreSQL connection. Do not add a database driver without using the Supabase pooler and a documented connection budget.

The production owner reviews database/storage use monthly. User learning data remains while the account is active; deletion/export requests require a future documented privacy workflow. Operational logs retain 30 days in Sentry and must not include learning content.

## Performance budget

Before a production release, Lighthouse mobile targets are: LCP <= 2.5s, CLS <= 0.1 and total initial JavaScript <= 250KB gzip on public/auth routes. Heavy game and document modules must load only from their feature route. Add a Lighthouse CI job when production credentials and stable staging URL are available.

## Localization

Vietnamese is the current default product locale. All new date/time UI must use `Intl.DateTimeFormat` with the profile locale/timezone rather than hardcoded formats. Introducing an additional language requires a dedicated i18n migration; it must extract existing UI strings and preserve Vietnamese as the fallback.

## Change management

Each pull request owns one feature or operational concern. Dependency upgrades, refactors and feature changes are reviewed separately unless an incident requires otherwise. Every production-affecting change includes a rollback note.
