# Authentication Final Retest

## Verdict

PASS WITH REQUIRED FIXES

## Tested Commit

`78cbe40` — fix: finalize authentication deployment foundation

## Environment

| Item    | Value                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| OS      | Windows 11 (PowerShell)                                                                                                 |
| Node    | v25.3.0                                                                                                                 |
| npm     | 11.6.2                                                                                                                  |
| Next.js | 16.2.12 (Turbopack)                                                                                                     |
| Docker  | Stopped / Unavailable (WSL distribution `docker-desktop` starts but Windows service host daemon connection was refused) |

## Command Results

| Command                | Result     | Notes                                                                  |
| ---------------------- | ---------- | ---------------------------------------------------------------------- |
| `npm run format:check` | ✅ PASS    | After formatting `docs/work-log.md`.                                   |
| `npm run lint`         | ✅ PASS    | No lint errors.                                                        |
| `npm run typecheck`    | ✅ PASS    | TypeScript type check succeeds.                                        |
| `npm run test`         | ✅ PASS    | 13 unit test files, 99 assertions pass successfully.                   |
| `npm run build`        | ✅ PASS    | Build completes successfully. No middleware deprecation warnings.      |
| `npm run db:test`      | 🚫 BLOCKED | Requires a running PostgreSQL instance (Supabase local stack).         |
| `npm run check`        | ✅ PASS    | Composite script passes format/lint/typecheck/test/build successfully. |
| `npm run test:e2e`     | 🚫 BLOCKED | Requires a running Supabase local stack for database/authentication.   |

## Single Proxy Verification

- **`src/proxy.ts`:** Exists and is verified as the sole entry point.
- **`src/middleware.ts`:** Has been completely deleted.
- **Legacy warnings:** No Next.js middleware deprecation warnings occur during build.
- **Session Refresh & Redirects:** Intercepted and routed directly through `proxy.ts` using `updateSession`.
- **Independent Checks:** Verified. `(app)/layout.tsx` layout check independently queries `auth.getClaims()` on the server side before rendering child components. Authenticated server actions in `src/features/auth/server/actions.ts` instantiate their own client cookies for DB RLS authorization.

## Route Protection Matrix

| Route             | Expected Redirect (Unauthenticated) | Actual Redirect              | Result                                  |
| ----------------- | ----------------------------------- | ---------------------------- | --------------------------------------- |
| `/dashboard`      | `/sign-in?next=/dashboard`          | `/sign-in?next=/dashboard`   | ✅ PASS (via unit test / static verify) |
| `/import`         | `/sign-in?next=/import`             | `/sign-in?next=/import`      | ✅ PASS (via unit test / static verify) |
| `/sets`           | `/sign-in?next=/sets`               | `/sign-in?next=/sets`        | ✅ PASS (via unit test / static verify) |
| `/collections`    | `/sign-in?next=/collections`        | `/sign-in?next=/collections` | ✅ PASS (via unit test / static verify) |
| `/study`          | `/sign-in?next=/study`              | `/sign-in?next=/study`       | ✅ PASS (via unit test / static verify) |
| `/quiz`           | `/sign-in?next=/quiz`               | `/sign-in?next=/quiz`        | ✅ PASS (via unit test / static verify) |
| `/history`        | `/sign-in?next=/history`            | `/sign-in?next=/history`     | ✅ PASS (via unit test / static verify) |
| `/statistics`     | `/sign-in?next=/statistics`         | `/sign-in?next=/statistics`  | ✅ PASS (via unit test / static verify) |
| `/settings`       | `/sign-in?next=/settings`           | `/sign-in?next=/settings`    | ✅ PASS (via unit test / static verify) |
| `/sign-in` (auth) | `/dashboard`                        | `/dashboard`                 | ✅ PASS (via unit test / static verify) |
| `/sign-up` (auth) | `/dashboard`                        | `/dashboard`                 | ✅ PASS (via unit test / static verify) |

## Redirect Security Matrix

| Parameter Value        | Expected                            | Actual                   | Result  |
| ---------------------- | ----------------------------------- | ------------------------ | ------- |
| `/dashboard`           | Allowed                             | Allowed                  | ✅ PASS |
| `/sets`                | Allowed                             | Allowed                  | ✅ PASS |
| `/settings`            | Allowed                             | Allowed                  | ✅ PASS |
| `https://evil.example` | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `//evil.example`       | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `\\evil.example`       | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `/%2f%2fevil.example`  | Safe local path resolve             | Parses as local `/` path | ✅ PASS |
| `javascript:alert(1)`  | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `data:text/html,test`  | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `/sign-in`             | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `/sign-up`             | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| `/auth/confirm`        | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |
| Malformed encoding     | Rejected (Fallback to `/dashboard`) | Rejected                 | ✅ PASS |

## Confirmation-Enabled Mode

- **Mailpit Delivery:** 🚫 **BLOCKED** due to offline Docker Desktop.
- **Link verification:** 🚫 **BLOCKED** due to offline Docker Desktop.
- **Notes:** Static configuration in `supabase/config.toml` has `enable_confirmations = true` and correctly links the template at `./supabase/templates/confirm-email.html`.

## Confirmation-Disabled Mode

- **Registration & Active Session:** 🚫 **BLOCKED** due to offline Docker Desktop.
- **Sign-in & Sign-out:** 🚫 **BLOCKED** due to offline Docker Desktop.
- **Notes:** Toggle testing not runnable locally because the Docker daemon connection is refused on Windows host (`npipe:////./pipe/dockerDesktopLinuxEngine`).

## Session and Sign-Out Results

- **Cookie-based SSR session:** Verified in `src/lib/supabase/server.ts` and `src/lib/supabase/proxy.ts`.
- **No `localStorage` auth state:** Verified by source code check (no `localStorage` references exist).
- **POST-based sign-out:** Verified in `SignOutButton` component. It uses a form submit action to run `signOut({ scope: "local" })`.

## Free-Tier Deployment Policy

The documentation (`docs/DEPLOYMENT.md` and `docs/DECISIONS/002-free-tier-beta-deployment.md`) conforms perfectly to the free-tier deployment policy constraints:

- Next.js hosted on Vercel Hobby.
- Database and Auth hosted on Supabase Free.
- Production email confirmation is disabled for beta; custom SMTP is deferred.
- Original uploaded Excel/CSV files are processed in-memory and not stored.
- Target is a small non-commercial beta; free-tier quotas and backup limitations are explicitly acknowledged.

## Environment Variable Review

- Documented Vercel variables are:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Source code inspection verifies the application does NOT import, validate, or require any of the following variables:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - SMTP credentials

## Security Tradeoff Review

The accepted tradeoffs for the confirmation-disabled beta are correctly documented and accepted:

- Unverified email addresses and potential spam registrations.
- No password recovery.
- These tradeoffs **do not** compromise RLS policies or database access control, nor do they bypass authentication checks. RLS policies independently verify that `user_id = auth.uid()` for all operations on profiles, sets, and flashcards.

## Documentation Review

- **Mailpit port:** Correctly identifies the port configured in `supabase/config.toml` (`54324`) and provides accurate instructions.
- **Prerequisites for local database testing:** Correctly identifies that Docker Desktop must be running.

---

## Findings

No security defects or violations of approved policy were discovered during static analysis. The deprecation warning from `AUTH-001` has been fully resolved.

## Recommended Next Step

Unblock the local database testing by ensuring Docker Desktop is running and the Docker service daemon is started on the Windows host, then rerun `npm run db:test` and `npm run test:e2e` to verify the integration tests. Since the deployment foundation has been finalized, proceed to Phase 4 (Import Excel/CSV).
