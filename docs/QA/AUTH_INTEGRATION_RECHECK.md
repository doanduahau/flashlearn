# Authentication Integration Recheck Report

## Verdict

**FAIL (WITH DEFECTS IDENTIFIED)**

_While the local environment was successfully initialized, Docker daemon connected, database tests passed, and static analysis succeeded, the E2E integration tests revealed two critical regressions/defects in the routing and proxy configuration of commit `78cbe40`._

---

## Tested Commit

`78cbe40` — `fix: finalize authentication deployment foundation`

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
| **Mailpit**       | http://127.0.0.1:54324  |

---

## Command Results

| Command                | Result  | Notes                                                          |
| :--------------------- | :------ | :------------------------------------------------------------- |
| `npm run format:check` | ✅ PASS | Verified zero formatting errors in project files.              |
| `npm run lint`         | ✅ PASS | No ESLint warnings or errors.                                  |
| `npm run typecheck`    | ✅ PASS | TypeScript type check compiles successfully.                   |
| `npm run test`         | ✅ PASS | All 13 unit test files (99 assertions) pass.                   |
| `npm run db:test`      | ✅ PASS | All 6 pgTAP database files (63 assertions) pass.               |
| `npm run db:types`     | ✅ PASS | Database types match current schema perfectly.                 |
| `npm run test:e2e`     | ❌ FAIL | Fails on route redirects due to **AUTH-I01** and **AUTH-I02**. |

---

## Detailed Integration Findings

### **AUTH-I01 (Critical): Next.js Ignores Root-level `proxy.ts` in `src/` Directory Setup**

- **Symptom:** Unauthenticated visits to protected routes (e.g. `/dashboard`) redirect straight to `/sign-in` without appending the `?next=` query parameter (e.g., `/sign-in?next=/dashboard`).
- **Root Cause:** Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`. However, because this codebase uses a `src/` directory structure, Next.js expects the proxy file to be located at `src/proxy.ts`. The tested commit placed it at the project root `/proxy.ts`, meaning the Edge Middleware is completely ignored by the Next.js runtime.
- **Impact:** The proxy layer is bypassed. Authentication checks fall back entirely to `(app)/layout.tsx`, which performs a simple `redirect("/sign-in")` without appending the `next` parameter, breaking the redirect restoration flow.
- **Verification:** Moving `proxy.ts` to `src/proxy.ts` resolves this issue, causing the proxy redirection block to execute.

### **AUTH-I02 (Major): Route Protection Regression for Unknown Routes**

- **Symptom:** The E2E test `"unknown route redirects to sign-in when not authenticated"` fails because visiting an unknown route (like `/unknown-route-12345`) returns a 404 page instead of redirecting to the sign-in page.
- **Root Cause:** In the previous middleware implementation, the redirect checked `!isGuestRoute(pathname)`. In `proxy.ts` of the tested commit, this check was tightened to `!isGuestRoute(pathname) && isProtectedRoute(pathname)`. Since unknown paths are not in `isProtectedRoute`, the redirect is bypassed, exposing the 404 page of unauthenticated routes.
- **Impact:** Regressed behavior from the previous baseline. It violates the security specification where all non-guest routes should default to being hidden/protected.
- **Verification:** Reverting the check back to `!isGuestRoute(pathname)` inside the proxy route checks resolved the E2E failure.

---

## Confirmation-Enabled Mode Results

_Tested by resetting the local database, starting Mailpit SMTP, and running Playwright E2E tests with `enable_confirmations = true` (after temporarily fixing the proxy location)._

- **Sign-Up Flow:** ✅ PASS. The registration correctly sends a confirmation email to Mailpit.
- **Mailpit Verification:** ✅ PASS. Playwright successfully navigates to Mailpit (port `54324`), extracts the confirmation token, and navigates to the confirmation link.
- **Sign-Out Flow:** ✅ PASS. The session cookie is correctly cleared and redirected to `/sign-in`.

---

## Confirmation-Disabled Mode Results

_Tested by setting `enable_confirmations = false` in `supabase/config.toml`, restarting Supabase services via `supabase stop/start`, resetting the database schema, and adapting the signup tests to bypass Mailpit._

- **Auto-Confirm Registration:** ✅ PASS. Signing up with a new email address immediately initializes an authenticated session and redirects directly to `/dashboard`.
- **Subsequent Sign-In / Sign-Out:** ✅ PASS. Works identically to the confirmation-enabled mode.

---

## Summary of QA Recommendations

1. **Move `proxy.ts` to `src/proxy.ts`**: The proxy file must be relocated to the `src/` directory so Next.js can detect and execute it.
2. **Keep the `isProtectedRoute` condition in `src/proxy.ts`**: Unknown routes should return the not-found experience (404), not redirect to sign-in. The current condition correctly only redirects known protected routes.
3. **Windows Local E2E Tip**: On Windows environments during development/testing, configure the Playwright webServer checks to use `127.0.0.1:3000` rather than `localhost:3000` to avoid IPv6 resolution timeouts (`[::1]`) since Next.js only binds to the IPv4 address.
