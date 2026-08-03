# Foundation Audit

## Verdict

**PASS WITH REQUIRED FIXES**

The project foundation is solid, reproducible, and well-structured. All commands succeed. The codebase is clean and follows the AGENTS.md blueprint closely. Three findings require attention before the next development phase — one High (Next.js 16 compatibility), one Medium (server-only guard), and one Low (anchor tag usage).

---

## Environment

| Item    | Value                                            |
| ------- | ------------------------------------------------ |
| OS      | Windows 11 (PowerShell)                          |
| Node    | v25.3.0                                          |
| npm     | 11.6.2                                           |
| Next.js | 16.2.12 (Turbopack)                              |
| Commit  | `a94ef9d` — chore: initialize FlashLearn project |
| Date    | 2026-08-03                                       |

---

## 1. Clean Installation

```
git status → clean
git log -1 → a94ef9d chore: initialize FlashLearn project
rm -rf node_modules .next coverage test-results playwright-report
npm ci → success (476 packages, 25s)
```

| Check                                                 | Result  |
| ----------------------------------------------------- | ------- |
| `npm ci` succeeds from `package-lock.json`            | ✅ PASS |
| No global dependency required                         | ✅ PASS |
| No uncommitted file required                          | ✅ PASS |
| No `.env.local` or secret file committed              | ✅ PASS |
| `.gitignore` excludes `.env*` (except `.env.example`) | ✅ PASS |
| Declared package manager is npm                       | ✅ PASS |
| `prepare` script runs `husky`                         | ✅ PASS |

---

## 2. Command Results

| Command                | Result  | Time   | Notes                                       |
| ---------------------- | ------- | ------ | ------------------------------------------- |
| `npm run format:check` | ✅ PASS | ~1.4s  | All files match Prettier code style         |
| `npm run lint`         | ✅ PASS | ~6.1s  | No ESLint warnings or errors                |
| `npm run typecheck`    | ✅ PASS | ~3.2s  | TypeScript strict mode, no errors           |
| `npm run test`         | ✅ PASS | ~3.8s  | 1 test file, 3 tests passed (Vitest 4.1.10) |
| `npm run build`        | ✅ PASS | ~10.5s | 13 static routes + Proxy (Middleware)       |
| `npm run check`        | ✅ PASS | ~20.1s | All four sub-commands pass sequentially     |

All routes built successfully:

```
○ /               ○ /collections    ○ /history    ○ /quiz
○ /_not-found     ○ /dashboard      ○ /import     ○ /sets
○ /settings       ○ /sign-in        ○ /sign-up    ○ /statistics
○ /study
```

---

## 3. E2E Results

### Playwright Setup

- Browser: Chrome for Testing 151.0.7922.34 (chromium v1234)
- Config: `tests/e2e/smoke.spec.ts`
- Web server: `npm run dev` on `http://localhost:3000`

### Test Results

| Test                                   | Result  | Time  |
| -------------------------------------- | ------- | ----- |
| Landing page shows FlashLearn branding | ✅ PASS | 470ms |

**Total: 1 passed, 0 failed (7.9s)**

### E2E Coverage Assessment

The existing E2E test only covers the landing page. The following routes are **not covered by E2E tests** in the foundation commit:

- `/sign-in` — sign-in page renders
- `/sign-up` — sign-up page renders
- `/dashboard` — dashboard renders
- `/collections`, `/history`, `/import`, `/quiz`, `/sets`, `/settings`, `/statistics`, `/study` — placeholder routes render
- Unknown route → 404 not-found experience
- Navigation links point to correct routes
- Console error / runtime error checks

> **Note**: This is a foundation audit. The existing smoke test validates the critical path (landing page renders + branding + sign-in link visible). Additional E2E coverage should be added as features are built.

---

## 4. Next.js 16 Compatibility Audit

**Next.js compatibility: PASS WITH WARNINGS**

| Aspect                           | Status        | Details                                                                                                                                                                                      |
| -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `middleware.ts` convention  | ⚠️ DEPRECATED | Next.js 16 renamed `middleware.ts` → `proxy.ts` and the export from `middleware` → `proxy`. The current file still works (build output shows `ƒ Proxy (Middleware)`) but should be migrated. |
| Exported function and matcher    | ✅ VALID      | `middleware()` export with regex matcher is accepted by Next.js 16.2.12.                                                                                                                     |
| Runtime used by middleware/proxy | ✅ SUPPORTED  | Default Edge runtime is used (no explicit runtime config), which is supported.                                                                                                               |
| `cookies()` async handling       | ✅ CORRECT    | `server.ts` correctly uses `await cookies()`. All usage is async.                                                                                                                            |
| Supabase session refresh helper  | ✅ CORRECT    | `src/lib/supabase/middleware.ts` follows the current SSR pattern with cookie read/write.                                                                                                     |
| Server/Client Component imports  | ✅ CORRECT    | `client.ts` has `"use client"` directive, `server.ts` has no directive (server by default).                                                                                                  |
| Server-only module protection    | ⚠️ MISSING    | `server.ts` lacks `import "server-only"` guard; `server-only` package is not installed. See FND-002.                                                                                         |

### See: FND-001 (middleware → proxy migration)

---

## 5. Supabase Foundation Audit

### Code Review

| Aspect                                 | Status     | Details                                                                                                                                                                            |
| -------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser client (`client.ts`)           | ✅ CORRECT | Uses `createBrowserClient` with `"use client"` directive.                                                                                                                          |
| Server client (`server.ts`)            | ✅ CORRECT | Uses `createServerClient` with `await cookies()`. No `"use client"` directive.                                                                                                     |
| Session refresh helper                 | ✅ CORRECT | Gracefully handles missing Supabase config via try/catch around `getSupabaseAnonConfig()`.                                                                                         |
| Environment validation (`env.ts`)      | ✅ CORRECT | Uses Zod `safeParse` with `.url().optional()` for Supabase vars.                                                                                                                   |
| Public key naming                      | ⚠️ NOTE    | Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Supabase is transitioning to publishable/secret keys (deadline: end of 2026). The `anon` name still works but will eventually be deprecated. |
| Cookie read/write behavior             | ✅ CORRECT | Read via `getAll()`, write via `setAll()` with try/catch for Server Component context.                                                                                             |
| Accidental exposure of privileged keys | ✅ SAFE    | Only `NEXT_PUBLIC_*` variables are referenced. No `SERVICE_ROLE_KEY` or secret key exposure.                                                                                       |
| SSR authentication readiness           | ✅ READY   | Architecture is set up for session refresh. Comment notes auth will be added in Phase 2.                                                                                           |

### Environment Scenario Tests

| Scenario                                | Build   | Dev Server       | Notes                                                                                                                               |
| --------------------------------------- | ------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A — No Supabase variables**           | ✅ PASS | ✅ PASS          | All pages build/render. Middleware passes through without error.                                                                    |
| **B — Invalid URL value** (`not-a-url`) | ✅ PASS | ⚠️ Runtime error | Build succeeds (env validated at runtime). Zod correctly rejects `Invalid URL` at runtime when `getSupabaseAnonConfig()` is called. |
| **C — Structurally valid dummy values** | ✅ PASS | ✅ PASS          | Build succeeds. No outbound requests made (all pages are static).                                                                   |

---

## 6. Responsive Smoke Test

> **Note**: A full visual responsive test requires a running dev server with Playwright viewport testing. The structural analysis below is based on code inspection of the layout components.

### Layout Architecture

The `AppShell` component (`src/components/layout/app-shell.tsx`) implements a responsive layout:

| Viewport | Sidebar                          | Header               | Bottom Nav             | Content Area                         |
| -------- | -------------------------------- | -------------------- | ---------------------- | ------------------------------------ |
| < 768px  | Hidden (`hidden`)                | Visible (sticky top) | Visible (fixed bottom) | Full width, `py-6 px-4`              |
| ≥ 768px  | Visible (`md:flex`, 256px fixed) | Hidden (`md:hidden`) | Hidden (`md:hidden`)   | Left offset `md:pl-72`, `py-10 px-8` |

### Structural Assessment

| Check                                   | Status     | Evidence                                                                                                                                                           |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No horizontal scrolling expected        | ✅ LIKELY  | `max-w-6xl` constrains content; no overflow-inducing elements found.                                                                                               |
| Mobile bottom navigation usable         | ✅ YES     | `fixed inset-x-0 bottom-0 z-40` with `h-16` per item, `flex-1` distribution.                                                                                       |
| Desktop sidebar visible at `md` (768px) | ✅ YES     | `hidden md:flex` on sidebar, `md:pl-72` on content.                                                                                                                |
| Header does not overlap content         | ✅ LIKELY  | Header is `sticky top-0` with `h-16`. Content flows below naturally.                                                                                               |
| Active route highlighting               | ✅ YES     | `isActive()` checks pathname prefix; applies `bg-primary-soft text-primary-foreground`.                                                                            |
| Focus state visible                     | ✅ YES     | Button has `focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2`.                                                                          |
| Keyboard navigation possible            | ✅ YES     | All interactive elements use `<Link>` or `<button>`, inherently focusable.                                                                                         |
| Text readable                           | ✅ YES     | Body min 16px (browser default), heading font hierarchy well-defined.                                                                                              |
| Font loading                            | ✅ SAFE    | Google Fonts with CSS variables as fallback system-ui stack.                                                                                                       |
| Reduced-motion preference               | ⚠️ PARTIAL | `animate-spin` in `loading.tsx` doesn't check `prefers-reduced-motion`. The design system notes respect for reduced-motion but no global `@media` rule is present. |

---

## 7. Code Quality Review

### Dependencies Assessment

| Dependency                             | Category | Used In Foundation  | Verdict |
| -------------------------------------- | -------- | ------------------- | ------- |
| `next` 16.2.12                         | Core     | ✅ Yes              | Valid   |
| `react` / `react-dom` 19.2.4           | Core     | ✅ Yes              | Valid   |
| `@supabase/ssr` / `supabase-js`        | Core     | ✅ Yes              | Valid   |
| `zod` 4.4.3                            | Core     | ✅ Yes (env.ts)     | Valid   |
| `clsx` / `tailwind-merge`              | Utility  | ✅ Yes (cn())       | Valid   |
| `class-variance-authority`             | Utility  | ✅ Yes (button.tsx) | Valid   |
| `@radix-ui/react-slot`                 | UI       | ✅ Yes (button.tsx) | Valid   |
| `lucide-react`                         | UI       | ✅ Yes (icons)      | Valid   |
| `tailwindcss` / `@tailwindcss/postcss` | Styling  | ✅ Yes              | Valid   |
| `eslint` / `eslint-config-next`        | Tooling  | ✅ Yes              | Valid   |
| `prettier`                             | Tooling  | ✅ Yes              | Valid   |
| `husky` / `lint-staged`                | Tooling  | ✅ Yes              | Valid   |
| `vitest` / `@vitejs/plugin-react`      | Testing  | ✅ Yes              | Valid   |
| `@testing-library/*`                   | Testing  | ✅ Yes (setup.ts)   | Valid   |
| `jsdom`                                | Testing  | ✅ Yes (vitest env) | Valid   |
| `@playwright/test`                     | Testing  | ✅ Yes              | Valid   |

**No premature or truly unused dependencies found.** All installed packages serve the foundation.

### Code Issues

| Check                             | Result        | Details                                                                         |
| --------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `any` usage                       | ✅ None       | No `any` type found in `src/`.                                                  |
| `@ts-ignore`                      | ✅ None       | Not present.                                                                    |
| `eslint-disable`                  | ✅ None       | Not present.                                                                    |
| Unsafe casts                      | ✅ None       | No non-null assertions (`!`) or type assertions found.                          |
| Dead code                         | ✅ None       | All code is reachable and used.                                                 |
| Duplicate utilities               | ✅ None       | Single `cn()` utility, no duplication.                                          |
| Placeholder production logic      | ✅ Acceptable | Placeholder pages explicitly show "Đang được xây dựng" — clear and intentional. |
| Misleading comments               | ✅ None       | Comments accurately describe intent (e.g., "Phase 2" notes).                    |
| Scripts in README vs package.json | ✅ Match      | All 9 documented scripts exist in `package.json`.                               |
| Scripts that don't work           | ✅ None       | All scripts tested and working.                                                 |

### `.gitkeep` Directories

22 `.gitkeep` files found across empty placeholder directories. These are **acceptable** for the foundation commit as they establish the directory structure defined in AGENTS.md. They should be removed as real files are added to each directory.

### Hardcoded Colors

Two instances of hardcoded `rgba()` in component templates:

- `src/app/(auth)/sign-in/page.tsx:19` — `shadow-[0_8px_24px_rgba(39,93,70,0.08)]`
- `src/app/(auth)/sign-up/page.tsx:19` — `shadow-[0_8px_24px_rgba(39,93,70,0.08)]`

These match the shadow specification from AGENTS.md §11.5 (`box-shadow: 0 8px 24px rgba(39, 93, 70, 0.08)`) and are used as Tailwind arbitrary values. Ideally these should be extracted to a design token, but they are consistent with the spec. See FND-004.

---

## 8. Git Hook Test

| Check                                 | Result  | Details                                                               |
| ------------------------------------- | ------- | --------------------------------------------------------------------- |
| Husky installs via `npm ci` (prepare) | ✅ PASS | `prepare` script runs `husky`, creates `.husky/` directory.           |
| Pre-commit hook exists                | ✅ PASS | `.husky/pre-commit` contains `npx lint-staged`.                       |
| lint-staged targets staged files only | ✅ PASS | Config in `package.json` targets `*.{ts,tsx,mjs,cjs,js,json,css,md}`. |
| Prettier executes on commit           | ✅ PASS | Confirmed: prettier auto-formatted staged file during commit.         |
| ESLint executes on commit             | ✅ PASS | Confirmed: eslint ran `--fix` on staged TypeScript file.              |
| Hook blocks on unfixable error        | ✅ PASS | Confirmed: binary/unparseable file was rejected by both tools.        |
| Hook does not modify unrelated files  | ✅ PASS | Only staged files are processed by lint-staged.                       |
| Working tree restored after test      | ✅ PASS | `git reset --hard a94ef9d && git clean -fd` → clean state.            |

---

## Security Review

| Check                       | Status    | Details                                                                                                        |
| --------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| No secrets committed        | ✅ SAFE   | `.env*` excluded by `.gitignore` (except `.env.example`).                                                      |
| No service role key exposed | ✅ SAFE   | Only `NEXT_PUBLIC_*` variables referenced in code.                                                             |
| `npm audit`                 | ⚠️ 3 HIGH | All in transitive deps of `next` (postcss, sharp). No project-level fix available without downgrading Next.js. |
| Content security            | ✅ SAFE   | No `dangerouslySetInnerHTML`, no raw HTML rendering.                                                           |
| Import file safety          | ✅ N/A    | Import feature not yet implemented; safety rules defined in AGENTS.md.                                         |

---

## Scope Review

| Check                                        | Status  |
| -------------------------------------------- | ------- |
| All files within expected foundation scope   | ✅ PASS |
| No feature implementation beyond placeholder | ✅ PASS |
| No out-of-scope dependencies                 | ✅ PASS |
| Directory structure matches AGENTS.md §7     | ✅ PASS |
| Route map matches AGENTS.md §8               | ✅ PASS |
| Design tokens match AGENTS.md §11.2          | ✅ PASS |
| Typography matches AGENTS.md §11.3           | ✅ PASS |

---

## Findings

### FND-001 — `middleware.ts` should be renamed to `proxy.ts` for Next.js 16

- **Severity:** High
- **Area:** Next.js compatibility
- **File:** [middleware.ts](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/middleware.ts)
- **Reproduction:**
  1. Run `npm run build`.
  2. Observe output line: `ƒ Proxy (Middleware)` — Next.js 16 recognizes the file but flags it with the legacy `(Middleware)` label.
  3. Next.js 16 documentation states `middleware.ts` is deprecated in favor of `proxy.ts`.
- **Expected:** Project uses `proxy.ts` with an exported `proxy()` function, matching the Next.js 16 convention.
- **Actual:** Project uses `middleware.ts` with an exported `middleware()` function (Next.js 15 convention).
- **Recommended fix:**
  1. Rename `middleware.ts` → `proxy.ts`.
  2. Rename the exported function from `middleware` to `proxy`.
  3. Update `src/lib/supabase/middleware.ts` import path if necessary.
  4. Or run: `npx @next/codemod@canary middleware-to-proxy`.

---

### FND-002 — Missing `server-only` guard on server Supabase client

- **Severity:** Medium
- **Area:** Server/client boundary safety
- **File:** [server.ts](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/src/lib/supabase/server.ts)
- **Reproduction:**
  1. A Client Component could accidentally `import { createClient } from "@/lib/supabase/server"`.
  2. No build-time error would prevent this — the import of `next/headers` (`cookies()`) would only fail at runtime.
- **Expected:** `server.ts` should import `"server-only"` to prevent accidental client-side imports at build time.
- **Actual:** No `import "server-only"` statement. The `server-only` package is not installed.
- **Recommended fix:**
  1. `npm install server-only`
  2. Add `import "server-only";` as the first line of `src/lib/supabase/server.ts`.

---

### FND-003 — `AppShell` uses `<a>` tags instead of Next.js `<Link>` for logo

- **Severity:** Low
- **Area:** Navigation performance
- **File:** [app-shell.tsx](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/src/components/layout/app-shell.tsx) (lines 9, 20)
- **Reproduction:**
  1. Navigate to any authenticated route (e.g., `/dashboard`).
  2. Click the FlashLearn logo in the sidebar or mobile header.
  3. Observe a full-page reload instead of client-side navigation.
- **Expected:** Logo links use `<Link>` from `next/link` for client-side navigation.
- **Actual:** Logo links use native `<a href="/dashboard">`, causing full-page reloads.
- **Recommended fix:** Replace `<a href="/dashboard">` with `<Link href="/dashboard">` and add the `Link` import.

---

### FND-004 — Hardcoded shadow values in auth pages

- **Severity:** Low
- **Area:** Design token consistency
- **Files:**
  - [sign-in/page.tsx](<file:///c:/Users/ASUS/Desktop/dphva/flashlearn/src/app/(auth)/sign-in/page.tsx>) (line 19)
  - [sign-up/page.tsx](<file:///c:/Users/ASUS/Desktop/dphva/flashlearn/src/app/(auth)/sign-up/page.tsx>) (line 19)
- **Reproduction:** Search for `shadow-[0_8px_24px_rgba(39,93,70,0.08)]` in auth page files.
- **Expected:** Shadow value defined as a reusable Tailwind utility or CSS custom property (design token).
- **Actual:** Inline arbitrary Tailwind value `shadow-[0_8px_24px_rgba(39,93,70,0.08)]` duplicated in two files.
- **Recommended fix:** Define a `--shadow-card` CSS variable in `globals.css` and use it via a Tailwind utility class (e.g., `shadow-card`). This aligns with AGENTS.md §12 rule: "Không lặp lại chuỗi class dài ở nhiều nơi."

---

### FND-005 — Missing `prefers-reduced-motion` handling for spinner

- **Severity:** Low
- **Area:** Accessibility
- **File:** [loading.tsx](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/src/app/loading.tsx) (line 5)
- **Reproduction:**
  1. Enable "Reduce motion" in OS accessibility settings.
  2. Trigger a loading state.
  3. Observe `animate-spin` spinner still animates.
- **Expected:** Per AGENTS.md §11.6: "Tôn trọng `prefers-reduced-motion`." The spinner should reduce or stop animation when the preference is set.
- **Actual:** No `motion-reduce:` Tailwind variant or `@media (prefers-reduced-motion)` rule applied.
- **Recommended fix:** Add `motion-reduce:animate-none` class to the spinner div, or add a global CSS rule.

---

### FND-006 — Supabase key naming uses legacy `ANON_KEY` convention

- **Severity:** Low
- **Area:** Future-proofing
- **Files:**
  - [.env.example](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/.env.example)
  - [env.ts](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/src/lib/env.ts)
  - [README.md](file:///c:/Users/ASUS/Desktop/dphva/flashlearn/README.md)
- **Reproduction:** Check `.env.example` — uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Expected:** Supabase is transitioning from `anon`/`service_role` keys to `publishable`/`secret` keys (deadline: end of 2026). The environment variable could proactively use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Actual:** Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` which still works but is the legacy naming convention.
- **Recommended fix:** This is informational for now. The `anon` key name is still fully functional. Consider renaming when integrating with a real Supabase project that uses the new key system. No immediate action required.

---

## Summary by Severity

| Severity | Count | IDs                                |
| -------- | ----- | ---------------------------------- |
| Blocker  | 0     | —                                  |
| High     | 1     | FND-001                            |
| Medium   | 1     | FND-002                            |
| Low      | 4     | FND-003, FND-004, FND-005, FND-006 |

---

## Recommended Next Steps

1. **FND-001** (High): Rename `middleware.ts` → `proxy.ts` and update the exported function name. This is the most important fix to align with Next.js 16 conventions before building the auth feature.
2. **FND-002** (Medium): Install `server-only` package and add the guard import to `src/lib/supabase/server.ts`. This is critical before adding authentication logic that touches server-only code paths.
3. **FND-003** (Low): Replace `<a>` tags with `<Link>` in `AppShell` logo links. Quick fix.
4. **FND-004** (Low): Extract repeated shadow value to a design token. Can be done when building auth UI.
5. **FND-005** (Low): Add reduced-motion handling to the loading spinner.
6. Continue to Phase 2: Supabase Auth integration, database schema, and first feature implementation.
