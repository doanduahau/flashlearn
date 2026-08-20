# Production Deployment

> **2026-08-19 operational addendum:** production releases require a separate staging deployment first. Set `CAPYSTUDY_ENVIRONMENT=staging` in staging and `CAPYSTUDY_ENVIRONMENT=production` in production. `FLASHLEARN_ENVIRONMENT` remains a deprecated compatibility alias and must match if both are set. Production requires `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` and `HEALTHCHECK_TOKEN`. The `CAPYSTUDY_*_MOCK` variables are accepted only when the runtime environment is `test`; they are inert in production.

CapyStudy Phase 3 production readiness documentation.
See `docs/DECISIONS/002-free-tier-beta-deployment.md` for the free-tier beta ADR.

---

## 1. Environment Contract

All environment variables classified by production role.

### A. Required Production Secrets (server-side only, never in browser bundles)

| Variable                    | Purpose                                                                                      | Set In     |
| --------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server client for RPC calls (import, quiz sessions, FSRS projections)                        | Vercel env |
| `GEMINI_API_KEY`            | Gemini Flash Lite API key for paste semantic generation + document generation/classification | Vercel env |

### B. Required Production Public/Browser Config

| Variable                               | Purpose                                                                                | Set In     |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| `NEXT_PUBLIC_APP_URL`                  | Application URL for auth redirects                                                     | Vercel env |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                                                   | Vercel env |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key for browser client                                                   | Vercel env |
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`   | Google OAuth web client ID (browser-safe)                                              | Vercel env |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`    | Google API key for Picker + Sheets API (browser config, MUST be externally restricted) | Vercel env |
| `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`      | Google Drive App / project number (browser-safe)                                       | Vercel env |

> `NEXT_PUBLIC_*` variables are bundled at Next.js build time. Changing them in Vercel requires a new deployment.

### C. Local/Test Only (must NOT be set in production)

| Variable                              | Production Value             | Purpose                                         |
| ------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `CAPYSTUDY_CLASSIFIER_MOCK`           | **must be absent** (not `1`) | Enables mocked document classifier in E2E tests |
| `CAPYSTUDY_GENERATION_MOCK`           | **must be absent** (not `1`) | Enables mocked Gemini generation in E2E tests   |
| `CAPYSTUDY_CLASSIFIER_COUNT_FILE`     | absent                       | Test-only counter file path                     |
| `CAPYSTUDY_GENERATION_COUNT_FILE`     | absent                       | Test-only counter file path                     |
| `CAPYSTUDY_GENERATION_MOCK_FAIL_FILE` | absent                       | Test-only failure flag file path                |

**RELEASE BLOCKER:** If any mock flag is `1` in production, `/api/test/*` routes become active (bypassing the 404 guard). Verify before every deployment.

### D. Optional Diagnostics (not required for app operation)

| Variable                                           | Purpose                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `CAPYSTUDY_PRODUCTION_SUPABASE_URL`                | Used by read-only FSRS diagnostics scripts only                        |
| `CAPYSTUDY_PRODUCTION_PROJECT_REF`                 | Used by production identity guard in diagnostics scripts               |
| `NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL` | Set to `1` only for deliberate local development against production DB |

### E. Deprecated / Unused

None found. All variables in `.env.example` are actively used by either the application or the E2E test runner.

---

## 2. Secret / Public Classification Rules

- `GEMINI_API_KEY` — **server secret.** Only used in server actions (`src/features/imports/server/`), server components, and the Gemini adapters. Never imported by `"use client"` components. The API key is read via `getGeminiApiKey()` in `src/lib/env.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` — **server secret.** Used by `getSupabaseServiceConfig()` for service-role RPC calls. Never exposed to browser.
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` — **public browser config.** Web application OAuth client ID. Safe in bundles.
- `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` — **public browser config but MUST be externally restricted.** The API key appears in browser-side Picker initialization (`setDeveloperKey`) and in `public-sheets.ts` URL queries. Google Cloud Console must restrict this key to: (a) HTTP referrer — production FlashLearn origin + localhost (if needed), (b) API — only Google Sheets API + Google Picker API.
- `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID` — **public browser config.** The project number / app ID for Google Picker. Safe in bundles.

---

## 3. Supabase Production Checklist

### Pre-deployment

- [ ] Supabase project exists at the URL configured in `NEXT_PUBLIC_SUPABASE_URL`
- [ ] RLS enabled on all tables (`flashcard_sets`, `flashcards`, `special_collections`, `special_collection_items`, `quiz_sessions`, `quiz_questions`, `card_review_events`, `card_learning_schedule`, `daily_learning_records`, `profiles`)
- [ ] Site URL in Supabase Auth → Authentication → URL Configuration matches `NEXT_PUBLIC_APP_URL`
- [ ] Redirect URLs include `{NEXT_PUBLIC_APP_URL}/auth/confirm`
- [ ] Email confirmation preference set per free-tier beta policy (see Free-Tier Beta ADR)

### Migration Safety

**Current local migration head:** `20260810180000_harden_new_cards_read_model.sql`

Phase 3 depends on these migrations (minimum):

| Migration                                               | Feature                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `20260805120000_add_atomic_flashcard_import.sql`        | `import_flashcard_set` RPC — Phase 1 foundation, used by all import paths |
| `20260806110000_add_quiz_engine.sql`                    | Quiz sessions, questions, choices, answer RPC                             |
| `20260810120000_add_explicit_quiz_card_sessions.sql`    | `create_quiz_session_from_card_ids` — explicit card quiz creation         |
| `20260810130000_secure_explicit_quiz_card_sessions.sql` | `create_owned_quiz_session_from_card_ids` service-role wrapper            |
| `20260810140000_add_quiz_session_origin.sql`            | Quiz session origin column + trigger + smart_review path                  |
| `20260810150000_add_fsrs_schedule_projection.sql`       | `card_learning_schedule` table + `upsert_card_learning_schedule` RPC      |

### Migration Verification Procedure (3H.5)

1. Compare local migration filenames against Supabase dashboard → Database → Migrations list.
2. If remote is at local head (all 23 files applied): no migration action needed.
3. If remote is behind: inspect exact pending migrations; assess individually; apply only expected committed migrations.
4. **If remote contains unexpected migrations or the migration list differs:** STOP. Investigate drift. Do not push blind.
5. If a new application release requires a new migration: apply the migration **before** deploying the app update that depends on it.

### RLS Verification

Each migration file includes RLS policy creation. Verify in production:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('flashcard_sets','flashcards','quiz_sessions','quiz_questions','card_review_events','card_learning_schedule','profiles','special_collections','special_collection_items','daily_learning_records');
```

All should show `rowsecurity = true`.

---

## 4. Google Cloud External Checklist (3H.5 manual checks)

These checks require Google Cloud Console access. Cannot be verified from the repository.

### OAuth Client

- [ ] Web application client type
- [ ] Production JS origin (`NEXT_PUBLIC_APP_URL`) is an authorized JavaScript origin
- [ ] `http://localhost:3000` or `http://127.0.0.1:3000` added for development (if desired)
- [ ] Scope: `https://www.googleapis.com/auth/drive.file` only (no broad `drive.readonly`)
- [ ] No refresh token or `offline_access` scope configured — application uses transient access tokens only

### Browser API Key

- [ ] Application restrictions: HTTP referrer
- [ ] Allowed referrers: production FlashLearn origin (`NEXT_PUBLIC_APP_URL`)
- [ ] Localhost allowed only if development access is desired
- [ ] API restrictions: Google Sheets API + Google Picker API

### Enabled APIs

- [ ] Google Sheets API — enabled
- [ ] Google Picker API — enabled
- [ ] Google Drive API — not required (Picker handles file selection, OAuth handles access)

---

## 5. Gemini Production Checklist

### Current Configuration

| Property                     | Value                                                                    | Source                                                 |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Model                        | `gemini-flash-lite-latest`                                               | `gemini-provider.ts:11`, `gemini-classifier.ts:11`     |
| API key location             | `GEMINI_API_KEY` (server secret)                                         | `src/lib/env.ts`                                       |
| Retry attempts               | `1` (no retry on transient failure)                                      | `src/features/imports/adapters/gemini-retry-policy.ts` |
| Input bound (classification) | Per-section text, bounded by `DOCUMENT_MAX_EXTRACTED_CHARS` (100k) total | `constants.ts:36`                                      |
| Input bound (generation)     | Per-chunk capped at `DOCUMENT_GENERATION_MAX_INPUT_CHARS` (50k)          | `constants.ts:41`                                      |
| Output bound                 | `GEMINI_MAX_OUTPUT_CARDS` (100) per generation call                      | `constants.ts:31`                                      |
| Max calls per document       | 10 classification + 10 generation = 20 total                             | `constants.ts:39-40`                                   |
| Deterministic avoidance      | Structured `flashcard_like` sections use zero Gemini calls               | `generate-document-cards.ts:368-372`                   |

### Pre-deployment

- [ ] `GEMINI_API_KEY` set in Vercel env (server-side, not `NEXT_PUBLIC_*`)
- [ ] Verify key has access to `gemini-flash-lite-latest` model
- [ ] No billing surprises: review Google AI Studio / Cloud Console quota settings

### No live Gemini calls in 3H.4

---

## 6. Pre-Deploy Local Gate

Single canonical release gate. All must PASS:

```bash
npm run check      # lint + typecheck + unit tests + build
npm run test:e2e   # full E2E suite (requires local Supabase + Playwright)
npm run db:test    # all 23 pgTAP files (requires local Supabase)
npm run test:pdf-runtime-isolation # production-build /sets with PDF runtime blocked
```

The PDF isolation gate builds the application and runs `next start` locally. It
blocks `pdf-parse` at runtime while exercising Manual, Excel, Paste, Sheets, and
DOCX paths, proving that only an actual PDF upload may initialize the PDF stack.

Also verify:

```bash
git status         # → clean working tree, no uncommitted changes
git log --oneline -3  # → confirm exact commit intended for deployment
```

Current verified baseline (2026-08-11):

- `npm run check`: PASS (lint 0 errors, 14 warnings, typecheck clean, 861 unit tests, build clean)
- `npm run test:e2e`: 114 discovered / 114 passed / 0 failed
- `npm run db:test`: 23/23 files PASS, 408 tests, 0 failures

---

## 7. Deployment Order (3H.5 Execution Plan)

```
1. LOCAL GATE
   ├── npm run check       → must PASS
   ├── npm run test:e2e    → must PASS (114/114)
   ├── npm run db:test     → must PASS (23/23, 408 tests)
   └── git status          → clean tree, confirm commit

2. PRODUCTION ENV
   ├── Verify all required Vercel env vars are set
   ├── Verify no mock flags (FLASHLEARN_*_MOCK) are set
   └── Verify Gemini API key / Supabase keys are present

3. GOOGLE CLOUD (manual)
   ├── Verify OAuth client origins + redirect URIs
   ├── Verify browser API key restrictions (referrer + APIs)
   └── Verify Sheets API + Picker API are enabled

4. SUPABASE REMOTE (manual)
   ├── Compare migration history (local vs remote)
   ├── Apply migrations ONLY if remote is behind and migrations are expected
   └── If unexpected drift → STOP, do not deploy

5. DEPLOY
   └── Vercel deploy (git push to production branch or dashboard trigger)

6. PRODUCTION SMOKE (see §8)
   ├── Run all smoke cases
   └── Record results in post-deploy log (§10)

7. STOP / ROLLBACK if any smoke case fails (see §9)
```

---

## 8. Production Smoke Matrix

All cases run against the deployed production URL after deployment.

### A. Authentication

- [ ] Open `NEXT_PUBLIC_APP_URL` → landing page renders
- [ ] Navigate to `/sign-up` → registration form renders
- [ ] Create test account → redirected to `/dashboard`
- [ ] Sign out → redirected to `/sign-in`
- [ ] Sign in with same credentials → redirected to `/dashboard`

### B. Manual Set Creation (0 AI)

- [ ] Navigate to `/sets` → "Tạo bộ" section visible
- [ ] Click "Thủ công" (Manual)
- [ ] Enter name: "Smoke Test Manual"
- [ ] Create 3 cards: F1/B1, F2/B2, F3/B3
- [ ] Click "Tạo bộ"
- [ ] Redirected to `/sets/[id]` showing 3 cards

### C. Excel Import (deterministic, 0 Gemini)

- [ ] Click "Nhập Excel" from `/sets`
- [ ] Upload a small 2-column CSV (3–5 rows)
- [ ] Editor appears with correct cards
- [ ] Name: "Smoke Test Excel"
- [ ] Click "Tạo bộ flashcard"
- [ ] Redirected to `/sets/[id]` showing cards

### D. Paste — Structured (deterministic, 0 Gemini)

- [ ] Click "Dán nội dung" from `/sets`
- [ ] Paste: `apple\tquả táo\nbanana\tquả chuối` (TSV format)
- [ ] Click "Phân tích"
- [ ] Editor appears with 2 cards
- [ ] Name: "Smoke Test Paste TSV"
- [ ] Import → verify correct set

### E. Paste — Semantic (live Gemini, 1 call)

- [ ] Click "Dán nội dung" from `/sets`
- [ ] Paste a single continuous prose sentence (e.g., "Hệ điều hành là phần mềm quản lý tài nguyên máy tính và cung cấp giao diện cho người dùng.")
- [ ] Click "Phân tích"
- [ ] Editor appears with AI-generated cards (count ≥ 1)
- [ ] Import → verify set created
- [ ] **Cost:** 1 Gemini generation call. Fixture: < 500 characters.

### F. Google Sheets (OAuth + Picker, 0 AI for structured)

- [ ] Click "Google Sheets" from `/sets`
- [ ] Click "Mở Google Sheets" → OAuth consent screen appears
- [ ] Authenticate → Picker opens
- [ ] Select a small private spreadsheet (2 columns, 2–3 rows of data)
- [ ] Editor appears → verify correct cards
- [ ] Import → verify set created
- [ ] Sign out of Google account in browser (token cleanup)
- [ ] **Note:** This is the highest-risk smoke case due to external OAuth dependency. If Google Cloud OAuth origins aren't configured for production, this will fail — stop and fix before continuing.

### G. DOCX (extraction + auto-detection + generation)

- [ ] Click "Tài liệu" from `/sets`
- [ ] Upload a minimal `.docx` with a small Q/A table (e.g., 2 rows: Question/Answer)
- [ ] Extraction preview shows table content → headings/blocks appear
- [ ] Analysis summary shows "mục thẻ" badge (flashcard_like classification)
- [ ] Click "Tạo thẻ"
- [ ] Editor appears with cards from table
- [ ] Import → verify set created
- [ ] **Expected AI calls:** 0 (deterministic table extraction only)

### H. PDF (text-based extraction)

- [ ] Upload a minimal text-based `.pdf` (1 page, readable paragraph)
- [ ] Extraction preview shows text with page metadata
- [ ] Editor appears after generation
- [ ] Import → verify set created

### I. Study

- [ ] Navigate to `/study`
- [ ] Select one of the imported smoke test sets
- [ ] Start study session → flashcard viewer appears
- [ ] Flip card → front/back toggle works
- [ ] Navigate to next card

### J. Quiz

- [ ] Navigate to `/quiz`
- [ ] Select one or two smoke test sets (at least 10 total cards)
- [ ] Choose "Balanced" mode, 10 questions
- [ ] Start quiz
- [ ] Answer all 10 questions
- [ ] Submit → result screen with score appears
- [ ] Verify streak updated on `/dashboard`

### K. Scheduling Regression Check

- [ ] After completing quiz, verify no visible error in UI
- [ ] No 500 errors in any navigation
- [ ] FSRS schedule projection should be created/updated (verify no console errors)

### Mobile Smoke (at least 1 real mobile viewport check)

- [ ] Open production URL in phone browser or Chrome DevTools mobile emulation (390×844)
- [ ] Navigate source selector (`/sets`) → buttons wrap correctly, no horizontal overflow
- [ ] Open a paste test → textarea, editor, set name, import button all reachable
- [ ] Study → flashcard fills viewport, flip works
- [ ] Quiz → options tappable, submit works
- [ ] No horizontal overflow on any page

---

## 9. Production Data Safety

### Smoke Test Data

- [ ] Use a **dedicated test account** for all smoke cases (if available)
- [ ] Name all smoke sets with a clear prefix: `[SMOKE] ...` or `Smoke Test ...`
- [ ] After smoke completes, delete smoke test sets from the application UI
- [ ] Delete the test account if no longer needed
- [ ] Do NOT modify unrelated user data
- [ ] Do NOT run destructive SQL queries against production

### AI Cost Discipline

- Structured / deterministic sources (Excel, CSV, TSV paste, Q/A tables in DOCX): expect **zero Gemini calls**.
- Live AI smoke (semantic paste): **exactly 1 controlled call** with a < 500 character fixture.
- Do not upload large documents during smoke.
- Do not "stress test" production during release.

---

## 10. Rollback / Stop Conditions

### Immediate STOP conditions (abort deployment)

| Condition                                                                     | Action                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Auth broken (sign-in/sign-up fails)                                           | STOP. Previous deployment is better than a broken one.                                                                    |
| Import creates partial or zero-card sets                                      | STOP. Investigate RPC/migration state.                                                                                    |
| Migrations unexpectedly differ between local and remote                       | STOP. Investigate drift.                                                                                                  |
| Production build lacks required env vars                                      | STOP. Fix Vercel env before redeploy.                                                                                     |
| Google OAuth or Picker blocked                                                | STOP. Fix Google Cloud configuration.                                                                                     |
| Gemini server configuration unavailable (`GEMINI_API_KEY` missing or invalid) | STOP. Structured import still works without Gemini; decide whether to proceed without semantic paste/document generation. |
| Widespread 5xx errors                                                         | STOP. Rollback deployment.                                                                                                |
| Study/Quiz regression (cannot start or complete sessions)                     | STOP. Rollback.                                                                                                           |
| Mock flags found enabled in production (`FLASHLEARN_*_MOCK=1`)                | STOP. Remove flags and redeploy.                                                                                          |

### Application Rollback

CapyStudy deploys to Vercel via git. The simplest rollback:

1. In Vercel dashboard → Deployments → select previous successful deployment → "Promote to Production"
2. Or: `git revert` the deployment commit and push.

### Database Rollback Policy

- **No automatic DB rollback.** Migrations are additive; reversing them requires careful analysis.
- If a migration was applied during this deployment and caused issues: **STOP. Do not attempt ad-hoc reverse migrations.**
- If the migration was the sole change and is reversible: manually analyze before acting.
- Prefer redeploying the previous app version (which was compatible with the previous schema) over database surgery.

---

## 11. Post-Deploy Record Template (3H.5)

```markdown
## 3H.5 Production Deployment Record

**Date:** YYYY-MM-DD
**Deployed commit:** <hash>
**Deployment URL:** <url>

### Pre-flight

- [ ] npm run check: PASS
- [ ] npm run test:e2e: ___ / ___ PASS
- [ ] npm run db:test: 23/23 PASS, 408 tests
- [ ] git status: clean
- [ ] Mock flags absent in production: YES
- [ ] All required env vars present: YES

### Migration State

- Local head: 20260810180000
- Remote head before deployment: ___
- Migrations applied: ___
- RLS verified: YES / NO

### Google Cloud Verification

- [ ] OAuth origins configured
- [ ] Browser API key restricted
- [ ] APIs enabled

### Smoke Results

- [ ] A. Authentication — PASS / FAIL
- [ ] B. Manual set creation — PASS / FAIL
- [ ] C. Excel import — PASS / FAIL
- [ ] D. Paste structured — PASS / FAIL
- [ ] E. Paste semantic — PASS / FAIL (___ Gemini calls)
- [ ] F. Google Sheets — PASS / FAIL
- [ ] G. DOCX — PASS / FAIL
- [ ] H. PDF — PASS / FAIL
- [ ] I. Study — PASS / FAIL
- [ ] J. Quiz — PASS / FAIL
- [ ] K. Scheduling — PASS / FAIL
- [ ] Mobile smoke — PASS / FAIL

### Cleanup

- [ ] Smoke test sets deleted
- [ ] Test account deleted (if applicable)

### Known Non-Blocking Issues

-
```

---

## 11A. Production Deployment Record — 2026-08-20

**Ngày triển khai:** 2026-08-20
**Production branch:** `main`
**Production commit:** `dcdca5c` (`ops: add production backup workflow`)
**Staging URL:** https://flashlearn-git-staging-pham-van-doans-projects.vercel.app
**Production URL:** https://flashlearn-six.vercel.app

### Migration Status

- Remote head: `20260819220000`
- Remote migrations applied: 46 (full set, no pending)
- Local migration head matches remote: YES
- RLS verified: YES (all public tables `rowsecurity = true`)

### Storage Preflight

- Storage preflight: PASS
- Maximum card-side characters: 81
- Card sides > 50,000: 0
- `storage_enforcement_mode` = `observe` (kept at observe; no warn/block)

### Smoke / Readiness

- Production `/api/health/ready` = 204
- Staging Sentry verified with `environment=staging`
- Production backup workflow (`npm run backup:production`) ran successfully (roles/schema/data + manifest)

### Rollback Decision

- Not required.

### Deferred

- Restore drill on an isolated Supabase project to demonstrate RTO <= 4h.
- Custom domain / email branding (not yet deployed).

---

## 12. Observability Readiness

### Current State

- `src/lib/logger.ts`: console-based logger with `info` (non-production only), `warn`, `error`
- Error boundary: `src/app/error.tsx` — user-friendly retry screen, `console.error(error)` for diagnostics
- Structured logging, Sentry breadcrumbs, correlation IDs and health/readiness probes are implemented. The initial commercial telemetry taxonomy and staged rollout flags are documented in `docs/TELEMETRY.md`; durable first-party usage records remain future work.

### Adequate for Controlled Smoke

Yes — console output from server actions is sufficient for diagnosing failures during a controlled release. The smoke test operator can monitor Vercel function logs for errors.

### Future Work (Before Public Beta)

- Server-side import success/failure logging (source type, card count, error type — never raw content)
- Gemini call counting / AI avoidance ratio
- Request correlation IDs and latency dashboards

---

## 13. Commercial-Readiness Classification

### FIX BEFORE THIS PRODUCTION RELEASE

- Ensure no `CAPYSTUDY_*_MOCK=1` in production env
- Ensure all required env vars are set
- Verify Google Cloud external configuration before enabling Sheets import

### BEFORE PUBLIC BETA

- Server-side import idempotency key (prevent double-import from batching races) — `docs/IMPORT.md` §3H.1
- Editor virtualization for >100 cards — `docs/IMPORT.md` §3H.1
- Google OAuth token lifecycle documentation
- Mock env vars documented in `.env.example` (already present)
- Basic import metrics logging
- Investigate retry policy: `GEMINI_RETRY_ATTEMPTS = 1` means zero retries on transient failures; consider `attempts: 3`

### WHEN SCALE DEMANDS

- Subscription / billing
- Usage quotas / rate limits
- Background job workers
- Content-hash cross-session AI deduplication
- Production event table partitioning (`card_review_events`)
- Commercial observability (Sentry, structured logging, latency metrics)

### Items Explicitly Deferred

- PWA / offline support
- Native mobile app
- Redis caching
- Microservices
- Admin platform
- SM-2 / advanced spaced repetition (FSRS is current)
- OCR / image import
- AI question generation outside paste/document context

---

## 14. Preflight Script

No new preflight script is added. The existing `npm run check` + `npm run test:e2e` + `npm run db:test` commands provide sufficient safety for a controlled single-operator deployment. Adding a script that duplicates existing validation would create maintenance burden without proportional safety gain.

The `.env.example` documentation and `src/lib/env.ts` Zod validation already fail-fast on missing required vars.

---

## 15. Cross-References

- `docs/IMPORT.md` — Phase 3 architecture, hardening audit, validation chain
- `docs/DECISIONS/002-free-tier-beta-deployment.md` — Free-tier beta deployment ADR
- `docs/ROUTES.md` — Complete route map
- `docs/DATABASE.md` — Database architecture, RLS policies, import RPC details
- `docs/AUTH.md` — Authentication configuration (Supabase Auth, proxy, email confirmation)
