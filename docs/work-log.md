# CapyStudy Work Log

## Session: Finalize Authentication Deployment Foundation

**Date:** 2026-08-05
**Branch:** main
**Commit:** 78cbe40

### Task

Finalize authentication deployment foundation: merge middleware into proxy.ts, fix Mailpit port docs, support both Supabase confirmation modes, document free-tier beta deployment policy.

### What was done

- AUTH-001: Deleted `src/middleware.ts`, merged all route protection logic into `proxy.ts`, created shared routes constant at `src/features/auth/utils/routes.ts`, updated `src/lib/supabase/proxy.ts` to return `{ response, claims }`, updated `proxy.ts` with auth/guest route redirects.
- AUTH-002: Fixed `docs/AUTH.md` Mailpit URL (port 8025 → `npm run supabase:status` / port 54324), updated audit docs to mark AUTH-001 as RESOLVED.
- Created `docs/DECISIONS/002-free-tier-beta-deployment.md` (ADR) and `docs/DEPLOYMENT.md`.
- Updated `README.md`, `docs/ARCHITECTURE.md`, `docs/ROUTES.md` to remove `middleware.ts` references.
- Updated `src/features/auth/utils/safe-redirect.ts` to use `ALL_GUEST_ROUTES` shared constant.
- Created test files: `proxy-behavior.test.ts`, `proxy-routes.test.ts`, `sign-up-outcomes.test.ts`, `deployment.test.ts`.
- Fixed `isGuestRoute`/`isProtectedRoute`/`isAuthRoute` to strip query params before matching.
- Fixed typecheck errors in test files (cast `Request` → `NextRequest`, used `Awaited<ReturnType<typeof createClient>>` instead of `ReturnType`).

### Verification

- `npm run check` passes: lint 0 errors, typecheck clean, 99/99 tests pass, build clean (no middleware deprecation warning).

### Remaining issues

- `npm run db:test` requires Supabase local DB (Docker) which is not running in this environment.
- `npm run test:e2e` requires Playwright browser setup and Supabase running.

### Commit

`78cbe40` — `fix: finalize authentication deployment foundation`

---

## Session: Activate Authentication Proxy

**Date:** 2026-08-05
**Branch:** main
**Commit:** (pending)

### Task

Fix the Next.js 16 Proxy activation defect: move `proxy.ts` from root to `src/proxy.ts`, correct the unknown-route E2E expectation, and make Playwright host deterministic on Windows.

### What was done

- Moved `proxy.ts` from project root to `src/proxy.ts` so Next.js 16 detects and executes it.
- Deleted root-level `proxy.ts`.
- Fixed `foundation.spec.ts` unknown-route test: changed expectation from "redirects to sign-in" to "renders 404 not-found experience".
- Changed Playwright config from `http://localhost:3000` to `http://127.0.0.1:3000` for deterministic Windows IPv4 resolution.
- Updated documentation (`docs/AUTH.md`, `docs/ARCHITECTURE.md`, `docs/ROUTES.md`) to reference `src/proxy.ts`.
- Updated QA audit files to reflect `src/proxy.ts` location.
- Added proxy activation tests (file location checks) and unknown-route behavior tests to `proxy-routes.test.ts`.
- Updated `deployment.test.ts` to check for `src/proxy.ts`.
- Updated `AUTH_INTEGRATION_RECHECK.md` recommendation: unknown routes should return 404, not redirect to sign-in.

### Verification

- `npm run check` passes: lint 0 errors, typecheck clean, all tests pass, build clean (no middleware deprecation warning).

### Remaining issues

- `npm run db:test` requires Supabase local DB (Docker) which is not running in this environment.
- `npm run test:e2e` requires Playwright browser setup and Supabase running.

### Commit

(pending)
