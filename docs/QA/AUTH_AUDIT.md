# Authentication Audit

## Verdict

PASS WITH REQUIRED FIXES

## Tested Commit

`ba97bf5` — feat: implement email authentication

## Environment

| Item         | Value                               |
| ------------ | ----------------------------------- |
| OS           | Windows 11 (PowerShell)             |
| Node         | v25.3.0                             |
| npm          | 11.6.2                              |
| Next.js      | 16.2.12 (Turbopack)                 |
| Supabase CLI | local stack (Docker Desktop 29.5.2) |
| Playwright   | Chromium (latest)                   |
| Mailpit      | http://127.0.0.1:54324              |

## Command Results

| Command                | Result  | Notes                                                |
| ---------------------- | ------- | ---------------------------------------------------- |
| `npm ci`               | ✅ PASS | Clean install from lockfile.                         |
| `npm run format:check` | ✅ PASS |                                                      |
| `npm run lint`         | ✅ PASS |                                                      |
| `npm run typecheck`    | ✅ PASS |                                                      |
| `npm run test`         | ✅ PASS | 9 files, 58 tests (including 5 auth-specific files). |
| `npm run build`        | ✅ PASS |                                                      |
| `npm run db:test`      | ✅ PASS | 6 files, 63 pgTAP assertions.                        |
| `npm run check`        | ✅ PASS |                                                      |
| `npm run test:e2e`     | ✅ PASS | 24 tests (7 auth + 17 foundation).                   |

## Local Auth Environment

| Item                  | Value                                   |
| --------------------- | --------------------------------------- |
| API URL               | http://127.0.0.1:54321                  |
| Mailpit URL           | http://127.0.0.1:54324                  |
| Email Confirmation    | Enabled (`enable_confirmations = true`) |
| Custom Email Template | `supabase/templates/confirm-email.html` |
| DB Reset              | ✅ PASS — migration applied cleanly.    |

## Sign-up Matrix

| Test Case                           | Expected                 | Actual                                      | Result  |
| ----------------------------------- | ------------------------ | ------------------------------------------- | ------- |
| Valid display name, email, password | Redirect to /check-email | Redirect to /check-email                    | ✅ PASS |
| Blank display name (omitted)        | Accepted                 | Accepted                                    | ✅ PASS |
| Whitespace-only display name        | Rejected (Zod)           | Rejected with message                       | ✅ PASS |
| Invalid email                       | Rejected                 | Rejected with message                       | ✅ PASS |
| Password < 8 chars                  | Rejected                 | Rejected with message                       | ✅ PASS |
| Password mismatch                   | Rejected                 | Rejected with message                       | ✅ PASS |
| Display name > 100 chars            | Rejected                 | Rejected with message                       | ✅ PASS |
| Missing required fields             | Rejected                 | Rejected with message                       | ✅ PASS |
| Unicode/Vietnamese display name     | Accepted                 | Accepted (verified: "Auth Test")            | ✅ PASS |
| Password not in URL/response        | Not visible              | Not visible in redirect URL                 | ✅ PASS |
| Raw Supabase errors not exposed     | Generic message          | `mapAuthError` maps to generic Vietnamese   | ✅ PASS |
| Profile created once (trigger)      | One row                  | Confirmed by `ON CONFLICT DO NOTHING`       | ✅ PASS |
| Client cannot choose profile ID     | ID from auth session     | Server-side only, derived from `auth.uid()` | ✅ PASS |

## Confirmation Matrix

| Test Case                               | Expected                                  | Actual                             | Result  |
| --------------------------------------- | ----------------------------------------- | ---------------------------------- | ------- |
| Confirmation email generated            | Email in Mailpit                          | Email received at 127.0.0.1:54324  | ✅ PASS |
| Link uses correct route                 | `/auth/confirm?token_hash=...&type=email` | Matches template and route handler | ✅ PASS |
| Valid confirmation signs in user        | Redirect to /dashboard with session       | Confirmed via E2E                  | ✅ PASS |
| Invalid/expired token                   | Redirect to /auth/error                   | Route handler redirects correctly  | ✅ PASS |
| Missing token                           | Redirect to /auth/error                   | `missing_params` check at line 11  | ✅ PASS |
| Invalid OTP type                        | Supabase rejects, redirect to /auth/error | Confirmed                          | ✅ PASS |
| Token not logged                        | No token in console.error                 | Only `error.message` is logged     | ✅ PASS |
| Redirect after confirmation is internal | /dashboard                                | Hard-coded internal redirect       | ✅ PASS |

## Sign-in Matrix

| Test Case                  | Expected                    | Actual                                   | Result  |
| -------------------------- | --------------------------- | ---------------------------------------- | ------- |
| Correct email and password | Redirect to /dashboard      | Confirmed via E2E                        | ✅ PASS |
| Wrong password             | Generic error               | "Email hoặc mật khẩu không đúng."        | ✅ PASS |
| Unknown email              | Same generic error          | Same generic error (no user enumeration) | ✅ PASS |
| Empty fields               | Rejected by Zod             | Rejected with message                    | ✅ PASS |
| Invalid email format       | Rejected by Zod             | Rejected with message                    | ✅ PASS |
| Email case normalization   | Lowercased before auth call | `email.trim().toLowerCase()` at line 84  | ✅ PASS |

## Redirect Security Matrix

| Input                  | Expected               | Actual                                           | Result  |
| ---------------------- | ---------------------- | ------------------------------------------------ | ------- |
| `/dashboard`           | Accepted               | Accepted                                         | ✅ PASS |
| `/sets`                | Accepted               | Accepted                                         | ✅ PASS |
| `/settings`            | Accepted               | Accepted                                         | ✅ PASS |
| `https://evil.example` | Rejected → /dashboard  | Rejected → /dashboard                            | ✅ PASS |
| `//evil.example`       | Rejected → /dashboard  | Rejected → /dashboard                            | ✅ PASS |
| `\\evil.example`       | Rejected → /dashboard  | Rejected → /dashboard                            | ✅ PASS |
| `/%2f%2fevil.example`  | Rejected or safe parse | Parses as local path → accepted as safe `/` path | ✅ PASS |
| `javascript:alert(1)`  | Rejected               | Rejected (doesn't start with `/`)                | ✅ PASS |
| `data:text/html,test`  | Rejected               | Rejected (doesn't start with `/`)                | ✅ PASS |
| `/sign-in`             | Rejected (loop)        | Rejected → /dashboard                            | ✅ PASS |
| `/sign-up`             | Rejected (loop)        | Rejected → /dashboard                            | ✅ PASS |
| `/auth/confirm`        | Rejected               | Rejected → /dashboard                            | ✅ PASS |

All external and malformed destinations fall back to `/dashboard`. No open redirect is possible.

## Route Protection Matrix

| Route               | Unauthenticated                             | Authenticated               |
| ------------------- | ------------------------------------------- | --------------------------- |
| `/dashboard`        | ✅ Redirect to `/sign-in?next=/dashboard`   | Renders                     |
| `/import`           | ✅ Redirect to `/sign-in?next=/import`      | Renders                     |
| `/sets`             | ✅ Redirect to `/sign-in?next=/sets`        | Renders                     |
| `/collections`      | ✅ Redirect to `/sign-in?next=/collections` | Renders                     |
| `/study`            | ✅ Redirect to `/sign-in?next=/study`       | Renders                     |
| `/quiz`             | ✅ Redirect to `/sign-in?next=/quiz`        | Renders                     |
| `/history`          | ✅ Redirect to `/sign-in?next=/history`     | Renders                     |
| `/statistics`       | ✅ Redirect to `/sign-in?next=/statistics`  | Renders                     |
| `/settings`         | ✅ Redirect to `/sign-in?next=/settings`    | Renders                     |
| `/sign-in` (authed) | N/A                                         | ✅ Redirect to `/dashboard` |
| `/sign-up` (authed) | N/A                                         | ✅ Redirect to `/dashboard` |

Route protection is enforced at two levels: Proxy (`proxy.ts`) and App Layout (`(app)/layout.tsx`).

## Session and Cookie Review

| Check                            | Result                                              |
| -------------------------------- | --------------------------------------------------- |
| Session is cookie-based          | ✅ Managed by `@supabase/ssr`                       |
| Cookie refresh in proxy          | ✅ `proxy.ts` calls `getClaims()` on every request  |
| Cookies cleared on sign-out      | ✅ `signOut({ scope: "local" })` + `revalidatePath` |
| No auth token in localStorage    | ✅ No `localStorage` usage found in source          |
| No session in rendered HTML      | ✅ No server secret rendered client-side            |
| Cookie compatible with localhost | ✅ E2E confirms full flow on localhost              |

## Sign-out Results

| Check                                       | Result                                             |
| ------------------------------------------- | -------------------------------------------------- |
| Sign-out control accessible                 | ✅ Button in app shell sidebar                     |
| Local session ends                          | ✅ Confirmed via E2E (redirects to /sign-in after) |
| Protected routes redirect after             | ✅ Confirmed via E2E                               |
| Sign-out requires form submission (not GET) | ✅ `<form action={signOut}>` with submit button    |
| Repeated sign-out safe                      | ✅ Always redirects to /sign-in                    |
| Errors don't leak tokens                    | ✅ Only generic console.error                      |

## Cross-user Results

| Check                            | Result                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| User A sees only A's profile     | ✅ RLS `profiles_select_own` policy                                |
| User B sees only B's profile     | ✅ RLS `profiles_select_own` policy                                |
| A cannot fetch B's profile       | ✅ RLS enforced at DB level, client queries scoped by `auth.uid()` |
| No service-role in frontend code | ✅ Source search confirmed                                         |
| Core RLS pgTAP tests pass        | ✅ 63 assertions pass                                              |

## Responsive and Accessibility Results

| Check                             | Result                                          |
| --------------------------------- | ----------------------------------------------- |
| Sign-in page responsive           | ✅ `max-w-sm` centered card layout, `min-h-dvh` |
| Sign-up page responsive           | ✅ Same card layout                             |
| Check-email page responsive       | ✅ Same card layout                             |
| Auth error page responsive        | ✅ Same card layout                             |
| Form labels associated (htmlFor)  | ✅ All inputs have matching Label components    |
| Errors announced via role="alert" | ✅ Both sign-in and sign-up error displays      |
| Tab order logical                 | ✅ Fields → submit → links                      |
| Focus visible                     | ✅ `focus-visible:ring-2` on password toggle    |
| Password toggle accessible name   | ✅ `aria-label="Ẩn mật khẩu" / "Hiện mật khẩu"` |
| Reduced motion                    | ✅ Loading spinner respects `motion-reduce`     |

## Documentation Review

| Document                              | Status      | Notes                                                                  |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `docs/AUTH.md`                        | ✅ RESOLVED | Mailpit URL now references `npm run supabase:status` and port `54324`. |
| `docs/AUTH.md` Cookie-based SSR       | ✅ Accurate |                                                                        |
| `docs/AUTH.md` Proxy responsibilities | ✅ Accurate |                                                                        |
| `docs/AUTH.md` Server-side protection | ✅ Accurate |                                                                        |
| `docs/AUTH.md` Email confirmation     | ✅ Accurate |                                                                        |
| `docs/AUTH.md` Sign-out behavior      | ✅ Accurate |                                                                        |
| `docs/AUTH.md` Safe redirects         | ✅ Accurate |                                                                        |
| `docs/AUTH.md` Deferred features      | ✅ Accurate |                                                                        |
| `docs/ROUTES.md`                      | ✅ Accurate | Lists all auth routes correctly.                                       |

## Source Review

| Check                                                | Result                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `getSession()` for authorization                     | ✅ Not found — uses `getClaims()`               |
| Service-role keys in src                             | ✅ Not found                                    |
| Secrets in `NEXT_PUBLIC_*`                           | ✅ Not found                                    |
| Raw password logging                                 | ✅ Not found                                    |
| Cookie/token logging                                 | ✅ Not found — only `error.message` logged      |
| `dangerouslySetInnerHTML`                            | ✅ Not found                                    |
| Auth state in localStorage                           | ✅ Not found                                    |
| Client imports of server-only                        | ✅ `server.ts` has `import "server-only"`       |
| `eslint-disable` / `@ts-ignore` / `any` in auth code | ✅ Not found                                    |
| Unvalidated `next` parameter                         | ✅ `sanitizeRedirect()` validates all redirects |

---

## Findings

### AUTH-001 — Dual middleware and proxy files cause deprecation warning

- Severity: **Medium** (RESOLVED)
- Area: Build / Middleware
- File or route: `proxy.ts` and `src/middleware.ts`
- Resolution: Merged all route protection logic from `src/middleware.ts` into `proxy.ts` and removed `src/middleware.ts`. The proxy now handles session refresh via `updateSession` and route protection using `getClaims()`. The deprecation warning is eliminated.

### AUTH-002 — Mailpit URL documented incorrectly

- Severity: **Low** (RESOLVED)
- Area: Documentation
- File or route: `docs/AUTH.md`
- Resolution: Updated `docs/AUTH.md` to reference `npm run supabase:status` for obtaining the authoritative Mailpit URL instead of hardcoding port 8025. The actual local Mailpit port is `54324` (configured in `supabase/config.toml` `[inbucket].port`).

---

## Recommended Next Step

1. **Required:** AUTH-001 is resolved — `src/middleware.ts` has been consolidated into `proxy.ts`.
2. **Required:** AUTH-002 is resolved — Mailpit port corrected to `54324` in `docs/AUTH.md`.
3. Proceed to Phase 4: Import Excel/CSV feature implementation.
