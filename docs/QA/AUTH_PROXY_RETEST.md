# Authentication Proxy Retest

## Verdict

**PASS WITH REQUIRED FIXES**

---

## Tested Commit

`bbf00ab` — `fix: activate authentication proxy`

Previous failed commit: `78cbe40` — `fix: finalize authentication deployment foundation`

---

## Environment

| Item              | Value                   |
| :---------------- | :---------------------- |
| **OS**            | Windows 11 (PowerShell) |
| **Node**          | v25.3.0                 |
| **npm**           | 11.6.2                  |
| **Docker Engine** | v29.5.2 (Running)       |
| **Supabase CLI**  | v2.111.0                |
| **Next.js**       | 16.2.12 (Turbopack)     |
| **Playwright**    | 1.62.1 (Chromium)       |
| **Mailpit**       | http://127.0.0.1:54324  |

---

## Command Results

| Command                           | Result     | Notes                                                                      |
| :-------------------------------- | :--------- | :------------------------------------------------------------------------- |
| `git status`                      | ✅ PASS    | Working tree clean at tested commit.                                       |
| `npm ci`                          | ✅ PASS    | 487 packages installed from lockfile.                                      |
| `docker version`                  | ✅ PASS    | Client v29.5.2, Server v29.5.2 — both available.                           |
| `npx playwright install chromium` | ✅ PASS    | Chromium browser binary installed.                                         |
| `npm run supabase:start`          | ✅ PASS    | API, PostgreSQL, Studio, Mailpit all running on expected ports.            |
| `npm run db:reset`                | ✅ PASS    | Migration applied, seed executed, containers restarted.                    |
| `npm run format:check`            | ✅ PASS    | Zero formatting errors.                                                    |
| `npm run lint`                    | ✅ PASS    | No ESLint errors.                                                          |
| `npm run typecheck`               | ✅ PASS    | TypeScript compiles successfully.                                          |
| `npm run test`                    | ✅ PASS    | 13 test files, 108 assertions pass.                                        |
| `npm run build`                   | ✅ PASS    | Build clean. Output shows `ƒ Proxy (Middleware)`. No deprecation warnings. |
| `npm run db:test`                 | ✅ PASS    | 6 pgTAP files, 63 assertions pass.                                         |
| `npm run check`                   | ✅ PASS    | Composite lint + typecheck + test + build passes.                          |
| `npm run test:e2e`                | ⚠️ PARTIAL | 23/24 pass in production mode. 1 failure: AUTH-P01.                        |

---

## Proxy Detection

| Check                                            | Result  |
| :----------------------------------------------- | :------ |
| `src/proxy.ts` exists                            | ✅ PASS |
| Root `proxy.ts` does not exist                   | ✅ PASS |
| No `src/middleware.ts` exists                    | ✅ PASS |
| `src/proxy.ts` exports `proxy` function          | ✅ PASS |
| Build output shows `ƒ Proxy (Middleware)`        | ✅ PASS |
| No legacy middleware deprecation warning         | ✅ PASS |
| Runtime: protected routes redirect with `?next=` | ✅ PASS |

The previous AUTH-I01 defect (proxy at wrong location) is **fully resolved**. The proxy is detected, compiled, and executed by Next.js 16.

---

## Protected Route Matrix

Tested in production mode (`npm run start`) against `127.0.0.1:3000`.

### Unauthenticated Access

| Route          | Redirects to `/sign-in` | `?next=` preserved | No content leak | Result  |
| :------------- | :---------------------- | :----------------- | :-------------- | :------ |
| `/dashboard`   | ✅                      | ✅ `/dashboard`    | ✅              | ✅ PASS |
| `/import`      | ✅                      | ✅ `/import`       | ✅              | ✅ PASS |
| `/sets`        | ✅                      | ✅ `/sets`         | ✅              | ✅ PASS |
| `/collections` | ✅                      | ✅ `/collections`  | ✅              | ✅ PASS |
| `/study`       | ✅                      | ✅ `/study`        | ✅              | ✅ PASS |
| `/quiz`        | ✅                      | ✅ `/quiz`         | ✅              | ✅ PASS |
| `/history`     | ✅                      | ✅ `/history`      | ✅              | ✅ PASS |
| `/statistics`  | ✅                      | ✅ `/statistics`   | ✅              | ✅ PASS |
| `/settings`    | ✅                      | ✅ `/settings`     | ✅              | ✅ PASS |

All 9 protected routes redirect correctly with `?next=` parameter. The previous AUTH-I01 defect (missing `?next=` parameter) is **resolved**.

### Prefix Collision Check

Unit tests verify `isProtectedRoute("/settings-public")` returns `false` — no prefix collisions detected.

---

## Unknown Route Result

| Scenario                                   | Expected             | Actual                  | Result  |
| :----------------------------------------- | :------------------- | :---------------------- | :------ |
| Unauthenticated GET `/unknown-route-12345` | 404 not-found page   | 404 with `<h1>404</h1>` | ✅ PASS |
| No redirect to `/sign-in`                  | No redirect          | No redirect             | ✅ PASS |
| No authenticated data leaked               | No user data visible | No user data visible    | ✅ PASS |

The previous AUTH-I02 finding has been resolved per the updated specification: unknown routes correctly render the not-found experience instead of redirecting to sign-in.

---

## Public and Guest Route Results

| Route           | Unauthenticated Access   | Authenticated Behavior       | Result      |
| :-------------- | :----------------------- | :--------------------------- | :---------- |
| `/`             | ✅ 200 OK                | Accessible                   | ✅ PASS     |
| `/sign-in`      | ✅ 200 OK                | Should redirect to dashboard | ⚠️ AUTH-P01 |
| `/sign-up`      | ✅ 200 OK                | Should redirect to dashboard | ⚠️ AUTH-P01 |
| `/check-email`  | ✅ 200 OK                | Accessible                   | ✅ PASS     |
| `/auth/error`   | ✅ 200 OK                | Accessible                   | ✅ PASS     |
| `/auth/confirm` | ✅ Dynamic route handler | Works during confirmation    | ✅ PASS     |

No redirect loops detected for any unauthenticated access.

---

## Redirect Security Matrix

Verified via unit tests (23 assertions in `safe-redirect.test.ts`) and E2E tests.

| `next` Parameter Value | Expected                | Actual   | Result  |
| :--------------------- | :---------------------- | :------- | :------ |
| `/dashboard`           | Allowed                 | Allowed  | ✅ PASS |
| `/sets`                | Allowed                 | Allowed  | ✅ PASS |
| `/settings`            | Allowed                 | Allowed  | ✅ PASS |
| `https://evil.example` | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `//evil.example`       | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `\\evil.example`       | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `/%2f%2fevil.example`  | Safe local path         | Safe     | ✅ PASS |
| `javascript:alert(1)`  | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `data:text/html,test`  | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `/sign-in`             | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `/sign-up`             | Rejected → `/dashboard` | Rejected | ✅ PASS |
| `/auth/confirm`        | Rejected → `/dashboard` | Rejected | ✅ PASS |
| Malformed encoding     | Rejected → `/dashboard` | Rejected | ✅ PASS |

No open redirect vulnerability detected.

---

## Static Matcher Review

The proxy `config.matcher` excludes:

```text
_next/static, _next/image, favicon.ico, *.svg, *.png, *.jpg, *.jpeg, *.gif, *.webp
```

| Check                                                    | Result                                                                |
| :------------------------------------------------------- | :-------------------------------------------------------------------- |
| `_next/static` excluded from proxy                       | ✅ PASS                                                               |
| `_next/image` excluded from proxy                        | ✅ PASS                                                               |
| `favicon.ico` excluded from proxy                        | ✅ PASS                                                               |
| Common image extensions excluded                         | ✅ PASS                                                               |
| Query strings with periods don't bypass protected routes | ✅ PASS (unit test: `isProtectedRoute("/sets/abc123?page=1")` → true) |
| Protected subroutes remain protected                     | ✅ PASS (unit test: `isProtectedRoute("/sets/abc123")` → true)        |
| Prefix collisions don't bypass protection                | ✅ PASS (unit test: `isProtectedRoute("/settings-public")` → false)   |

---

## Confirmation-Enabled Result

Tested with `enable_confirmations = true` (default local config).

| Step                                       | Result  |
| :----------------------------------------- | :------ |
| Register unique user                       | ✅ PASS |
| Redirect to `/check-email`                 | ✅ PASS |
| Confirmation email delivered to Mailpit    | ✅ PASS |
| Click confirmation link → `/dashboard`     | ✅ PASS |
| Display name visible on dashboard          | ✅ PASS |
| Sign out → `/sign-in`                      | ✅ PASS |
| Dashboard redirects to `/sign-in?next=`    | ✅ PASS |
| Sign in again with `next` parameter        | ✅ PASS |
| Safe next parameter restored after sign-in | ✅ PASS |
| Malicious next values rejected             | ✅ PASS |
| Protocol-relative next values rejected     | ✅ PASS |

No token leakage observed. Confirmation tokens are delivered via Mailpit and consumed correctly.

---

## Confirmation-Disabled Result

Not separately tested in this run. The previous AUTH_INTEGRATION_RECHECK verified this mode works. The proxy activation commit did not alter the sign-up action logic (`src/features/auth/server/actions.ts`), which handles both `data.session` (auto-confirm) and `!data.session` (check-email) paths identically to the previously tested version.

---

## Session and Sign-Out Result

| Check                                                 | Result  |
| :---------------------------------------------------- | :------ |
| Cookie-based SSR session via `@supabase/ssr`          | ✅ PASS |
| No `localStorage` auth state                          | ✅ PASS |
| POST-based sign-out via `signOut({ scope: "local" })` | ✅ PASS |
| Session cleared after sign-out                        | ✅ PASS |
| Protected routes redirect after sign-out              | ✅ PASS |

---

## Findings

### AUTH-P01 — Authenticated users are not redirected away from guest-only routes

- **Severity:** Medium
- **Area:** Proxy guest-route redirect
- **Reproduction:**
  1. Sign up a new user and confirm the account.
  2. Verify arrival at `/dashboard`.
  3. Navigate to `/sign-in`.
  4. **Expected:** Redirect to `/dashboard`.
  5. **Actual:** Page stays on `/sign-in`.
- **Expected:** The proxy's `isAuthenticated && isGuestRoute(pathname)` check in `src/proxy.ts` should redirect authenticated users visiting `/sign-in` or `/sign-up` to `/dashboard`.
- **Actual:** The redirect does not fire. The authenticated user remains on the guest page. The proxy's `updateSession` call uses `getClaims()` which may return `null` during the redirect navigation when the session cookies are being propagated by the Supabase SSR library, causing `isAuthenticated` to be `false` even though the user has an active session.
- **Impact:** Authenticated users can visit the sign-in and sign-up pages, which is a UX issue. This is not a security bypass — the user is already authenticated and no credentials are exposed.
- **Recommended fix:** Investigate whether `getClaims()` is returning `null` on certain navigations after recent authentication. Consider adding a fallback check using `getUser()` if `getClaims()` returns null, or verify that the Supabase SSR cookie pipeline is correctly populating session cookies on all responses from the confirmation handler.

### AUTH-P02 — E2E test infrastructure issues with `127.0.0.1` baseURL

- **Severity:** Low
- **Area:** Test infrastructure / Playwright configuration
- **Reproduction:** Run `npm run test:e2e` with `baseURL: "http://127.0.0.1:3000"` and `command: "npm run dev"`.
- **Expected:** All tests pass.
- **Actual:** Three issues:
  1. Next.js blocks cross-origin WebSocket HMR requests from `127.0.0.1` (needs `allowedDevOrigins` in `next.config.ts`).
  2. The confirmation email HTML template contains two `<a>` links with `href*="auth/confirm"`, causing Playwright strict mode violations when using `.waitFor()` without `.first()`.
  3. Dev mode server actions redirect to `localhost:3000` while the browser is on `127.0.0.1:3000`, causing cross-origin navigation failures.
- **Impact:** E2E tests only pass reliably when using `npm run start` (production mode) as the Playwright webServer command.
- **Recommended fix:**
  1. Add `allowedDevOrigins: ['127.0.0.1']` to `next.config.ts`.
  2. Use `.first()` on the confirmation link locator in `auth.spec.ts`.
  3. Either align `NEXT_PUBLIC_APP_URL` with the Playwright `baseURL`, or keep using `npm run start` for E2E.

---

## Recommended Next Step

1. **Fix AUTH-P01:** Investigate the guest-route redirect for authenticated users. The proxy logic is correct but the session detection may have a timing issue with `getClaims()` after recent authentication.
2. **Fix AUTH-P02:** Update `next.config.ts` and the E2E test locator for stable dev-mode E2E testing.
3. After fixes, re-run `npm run test:e2e` with all 24 tests passing.
4. Proceed to Phase 4 (Import Excel/CSV).
