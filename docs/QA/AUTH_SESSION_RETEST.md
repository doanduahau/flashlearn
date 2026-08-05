# Authentication Session Retest

## Verdict

**PASS WITH REQUIRED FIXES**

Authentication session persistence and all requested auth regressions pass. The audit is not an unconditional PASS because the required `npm run format:check` command fails on 87 tracked files at the tested commit.

## Tested Commit

`4de9163c5859a0f9181a308bf67a7cf71cf85022` — `fix: persist authentication session`

The verification ran from a clean source snapshot produced directly from this Git object. Existing untracked QA reports in the primary working tree were excluded.

## Proven Root Cause

The previous failure was caused by inconsistent canonical application hosts in the authentication path:

- Playwright and `.env.example` used `http://127.0.0.1:3000`.
- The runtime fallback and Supabase Auth configuration used `http://localhost:3000`.
- The confirmation handler constructed redirects from the incoming request URL instead of the canonical application origin.

Because auth cookies are host-scoped, crossing between `localhost` and `127.0.0.1` caused the confirmed session to be unavailable on subsequent application requests. Commit `4de9163` aligns the runtime fallback and Supabase URLs to `127.0.0.1`, builds confirmation redirects from `NEXT_PUBLIC_APP_URL`, and stops suppressing cookie-write failures in writable server boundaries.

The corrected flow was proven at runtime: the Mailpit confirmation URL used the canonical origin, the callback reached `/dashboard`, auth cookie names existed, and the same session survived refreshes and navigation in two pages sharing one browser context.

## Environment

| Item                 | Result                               |
| -------------------- | ------------------------------------ |
| OS                   | Windows 11 / PowerShell              |
| Node dependencies    | 487 packages installed from lockfile |
| Docker client/server | 29.5.2 / 29.5.2                      |
| Docker Desktop       | 4.76.0                               |
| Supabase CLI         | 2.111.0                              |
| Next.js              | 16.2.12                              |
| Playwright           | 1.62.1, Chromium                     |

`npm ci` reported three high-severity dependency audit findings. No dependency was changed because production changes were outside this retest's scope.

## Required Command Results

| Command                           | Result   | Evidence                                                               |
| --------------------------------- | -------- | ---------------------------------------------------------------------- |
| `npm ci`                          | PASS     | 487 packages installed from `package-lock.json`.                       |
| `docker version`                  | PASS     | Docker client and server responded.                                    |
| `npm run supabase:start`          | PASS     | Local services started on their configured ports.                      |
| `npm run db:reset`                | PASS     | Database recreated; migration and seed applied.                        |
| `npx playwright install chromium` | PASS     | Chromium installation completed.                                       |
| `npm run format:check`            | **FAIL** | Prettier reported style issues in 87 tracked files.                    |
| `npm run lint`                    | PASS     | No ESLint errors.                                                      |
| `npm run typecheck`               | PASS     | `tsc --noEmit` completed successfully.                                 |
| `npm run test`                    | PASS     | 13 files, 108 tests passed.                                            |
| `npm run build`                   | PASS     | Production build completed with 18 routes and active Proxy middleware. |
| `npm run db:test`                 | PASS     | 6 pgTAP files, 63 assertions passed.                                   |
| `npm run check`                   | PASS     | Lint, typecheck, unit tests, and build all passed.                     |
| `npm run test:e2e`                | PASS     | 25/25 tests passed; zero failures and zero skips.                      |

The first sandboxed build attempt could not download Google Fonts. Re-running with network permission passed and is the authoritative product result. PowerShell's script policy required invoking the Windows command shims (`npm.cmd`/`npx.cmd`), which execute the same npm/npx commands.

## Origin Consistency

**PASS** — no `localhost`/`127.0.0.1` mix exists in the externally observable auth flow.

| Boundary                               | Observed value                       |
| -------------------------------------- | ------------------------------------ |
| Playwright `baseURL`                   | `http://127.0.0.1:3000`              |
| Playwright server URL                  | `http://127.0.0.1:3000`              |
| `NEXT_PUBLIC_APP_URL` example          | `http://127.0.0.1:3000`              |
| Runtime fallback                       | `http://127.0.0.1:3000`              |
| Supabase `site_url`                    | `http://127.0.0.1:3000`              |
| Supabase allowed confirmation callback | `http://127.0.0.1:3000/auth/confirm` |
| Mailpit confirmation-link origin       | `http://127.0.0.1:3000`              |
| Auth callback result                   | `http://127.0.0.1:3000/dashboard`    |

Next.js was reached by Playwright through the configured `127.0.0.1:3000` server URL. The `http://localhost` literal in `safe-redirect.ts` is an inert URL-parser base for validating relative paths; it is never used as an application origin, redirect target, request host, or cookie scope.

## Session Flow

The required flow passed in one fresh Chromium context:

1. Registered a unique account.
2. Opened its Mailpit confirmation email.
3. Asserted the confirmation-link origin was exactly `http://127.0.0.1:3000`.
4. Opened the confirmation link and reached `/dashboard`.
5. Confirmed Supabase auth cookie names existed. Cookie values were neither printed nor recorded.
6. Refreshed `/dashboard`; the authenticated page remained available.
7. Opened `/sign-in`; it redirected to `/dashboard`.
8. Opened `/sign-up`; it redirected to `/dashboard`.
9. Opened a second page in the same context; `/dashboard`, refresh, `/sign-in`, and `/sign-up` all preserved the shared authenticated session and redirects.
10. Signed out; all auth-token cookies were absent afterward.
11. Confirmed `/sign-in` and `/sign-up` rendered as guest pages.

Observed session cookie names:

- `sb-127-auth-token-flow-f2f0eca45ca27259aa8ae79275ca1499-code-verifier`
- `sb-127-auth-token-flows-code-verifier`
- `sb-127-auth-token-code-verifier`
- `sb-127-auth-token.0`
- `sb-127-auth-token.1`

Only names are reported; no cookie values are included.

## Confirmation Modes

| Mode                  | Result | Evidence                                                                                                                                                                                                          |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmation enabled  | PASS   | Registration reached `/check-email`; the canonical Mailpit link confirmed the account; session persisted across refresh, guest-route checks, and a second page.                                                   |
| Confirmation disabled | PASS   | Supabase local was restarted with `enable_confirmations = false` in the disposable snapshot; registration went directly to `/dashboard`; session persisted across refresh and a second page; sign-out cleared it. |

The repository E2E test named `sign-up with email confirmation disabled` does not itself toggle Supabase configuration; it accepts either outcome. The separate disposable-snapshot run above verifies the disabled configuration directly.

## Regression Results

| Check                            | Result | Evidence                                                                                                                                                  |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected routes preserve `next` | PASS   | E2E verified `/dashboard` redirects to `/sign-in?next=/dashboard`, and safe sign-in restores it.                                                          |
| Unknown routes return 404        | PASS   | Verified for authenticated and unauthenticated contexts.                                                                                                  |
| Sign-out clears session          | PASS   | Auth cookie-name query returned no auth-token cookies after sign-out; guest pages rendered.                                                               |
| No open redirect                 | PASS   | External absolute and protocol-relative `next` values were rejected by passing E2E tests.                                                                 |
| No token leakage                 | PASS   | Callback ended on clean `/dashboard` with no token parameters; no cookie values were logged or added to this report.                                      |
| No cross-user access             | PASS   | All 63 pgTAP assertions passed, including user A being unable to read, create, update, or delete user B's sets, flashcards, collections, and memberships. |
| All E2E tests pass without skips | PASS   | 25 passed, 0 failed, 0 skipped.                                                                                                                           |

## Findings

### AUTH-S01 — Required formatting gate fails

- **Severity:** Medium
- **Status:** Required fix
- **Evidence:** `npm run format:check` exits 1 and reports 87 tracked files.
- **Impact:** The tested commit does not satisfy the repository's complete quality-gate requirement even though `npm run check` passes, because `check` does not include `format:check`.
- **Required action:** Normalize the reported files with the repository's Prettier configuration in a separate production-code task, review the resulting diff, and rerun the full command sequence.

### AUTH-S02 — Misleading confirmation-disabled E2E name

- **Severity:** Low
- **Status:** Test-quality improvement
- **Evidence:** The repository test accepts `/check-email` and then confirms when confirmations are enabled, so its name does not prove the disabled configuration.
- **Impact:** A future regression specific to confirmation-disabled operation could be missed if only that test name is trusted.
- **Required action:** Add an explicit configuration-controlled confirmation-disabled test in a separate test-change task. This audit verified the behavior through a disposable local configuration without modifying production code.

## Files Changed

- `docs/QA/AUTH_SESSION_RETEST.md` — added this audit report.

## Database Changes

None. The local database was reset and tested; no migration was created or modified.

## Environment Variables

None added or changed.

## Commands Executed

- `npm ci`
- `docker version`
- `npm run supabase:start`
- `npm run db:reset`
- `npx playwright install chromium`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run db:test`
- `npm run check`
- `npm run test:e2e`
- Targeted disposable Playwright audits for confirmation-enabled and confirmation-disabled session persistence.

## Remaining Issues

- Fix the 87-file Prettier failure before promoting the verdict to PASS.
- Make the confirmation-disabled E2E setup explicit rather than conditional.
- `npm ci` reports three high-severity dependency audit findings; assess them in a separate dependency-security task.

## Commit

No commit created. The required formatting gate does not pass, and this task is an audit/report-only change.

## Report Path

`docs/QA/AUTH_SESSION_RETEST.md`
