# 11. Testing & QA

> Inventory testing strategy hiện tại. Nguồn: `vitest.config.mts`,
> `playwright.config.ts`, `tests/`, `supabase/tests/`, `scripts/`, `docs/QA/`.

---

## 1. Layers

| Layer            | Tool                                   | Runner                                            | Config                                                               |
| ---------------- | -------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Unit + Component | Vitest + React Testing Library (jsdom) | `npm test`                                        | `vitest.config.mts` (alias `@` → src, jsdom, setup `tests/setup.ts`) |
| Integration      | Vitest                                 | `npm test` (cùng runner, `tests/integration/`)    | như trên                                                             |
| Database (pgTAP) | `supabase test db`                     | `npm run db:test`                                 | `supabase/tests/*.sql`                                               |
| E2E              | Playwright (chromium, 1 worker)        | `npm run test:e2e` → `scripts/test-e2e-local.mjs` | `playwright.config.ts` + runner script                               |

---

## 2. Unit / Component tests (`tests/unit/`)

- `tests/unit/features/` — theo feature: auth, dashboard, flashcard-sets, imports,
  learning-modes, mastery, match, memory, practice-coverage, profile, quiz,
  smart-review, source-selection, spaced-repetition, special-collections, statistics, study.
- `tests/unit/components/` — app-navigation, app-shell, pagination-controls, section-tabs.
- `tests/unit/app/` — test-only-routes.
- `tests/unit/lib/` — env, pagination, utils, deployment.

**Điểm mạnh:** business logic thuần được test rộng (import parsing, mastery derive,
match/memory session, streak utils, learning filters, spaced-repetition utils, quiz schema).

---

## 3. Integration tests (`tests/integration/`)

| Test                                                | Nội dung                                     |
| --------------------------------------------------- | -------------------------------------------- |
| `fsrs-shadow-quiz.integration.test.ts`              | Quiz answer → event → shadow FSRS projection |
| `fsrs-reconciliation.integration.test.ts`           | Reconcile projection từ events               |
| `fsrs-due-read.integration.test.ts`                 | Đọc due candidates                           |
| `direct-due-cutover.integration.test.ts`            | Chuyển direct due sang schedule              |
| `mastery-snapshot-completeness.integration.test.ts` | Mastery snapshot đầy đủ                      |
| `new-cards.integration.test.ts`                     | New cards read model                         |
| `card-scope-mismatch.integration.test.ts`           | Coverage scope mismatch (reset isolation)    |

Integration tests chạy cùng Vitest; có vẻ dùng fake/mock repository (không cần
Supabase thật — xác minh khi chạy). Các test này nhạy cảm với thay đổi logic FSRS/coverage.

---

## 4. Database tests (pgTAP — `supabase/tests/`)

25 file theo thứ tự migration (naming `NNN_*.sql` khớp migration):

| Test file                                                      | Kiểm tra                          |
| -------------------------------------------------------------- | --------------------------------- |
| `001_constraints`                                              | Constraints cơ bản                |
| `002_profiles`                                                 | Profile + trigger handle_new_user |
| `003_flashcard_sets_ownership`                                 | Ownership + RLS sets              |
| `004_special_collections_ownership`                            | RLS collections                   |
| `005_cascades`                                                 | Cascade xóa                       |
| `006_triggers`                                                 | set_updated_at, origin trigger    |
| `007_import_flashcard_set`                                     | Import atomic + position          |
| `008_set_card_mutations`                                       | Mutation thẻ                      |
| `009_special_collections_memberships`                          | Membership RPC                    |
| `010_special_collection_rpc_input_validation`                  | Input validation collection       |
| `011_profile_settings` / `011_quiz_engine`                     | Profile settings + quiz engine    |
| `012_learning_statistics`                                      | Stats RPC                         |
| `013_flashcard_set_ordering`                                   | Reorder                           |
| `014_card_review_events`                                       | Event log invariants              |
| `015_explicit_quiz_card_sessions`                              | Explicit card sessions            |
| `016_quiz_session_origin` / `016_card_learning_schedule_table` | Origin + schedule table           |
| `017_card_learning_schedule_rpc_acl`                           | ACL của RPC projection            |
| `018_card_learning_schedule_cas_integrity`                     | CAS integrity                     |
| `019_card_learning_schedule_hardening`                         | Hardening                         |
| `020_fsrs_shadow_quiz_answer`                                  | Quiz answer → FSRS shadow         |
| `021_new_cards`                                                | New cards read model              |
| `022_flashcard_coverage`                                       | Coverage                          |
| `023_learning_coverage_sessions`                               | Coverage sessions                 |
| `024_quiz_coverage_selection`                                  | Quiz coverage selection           |
| `025_strict_quiz_eligibility`                                  | Strict eligibility                |

Chạy: `npm run db:test` (cần local Supabase `supabase start`).

---

## 5. E2E (Playwright — `tests/e2e/`)

~32 spec files, chromium, **1 worker** (state shared qua 1 local Supabase + app server):

| Spec                                                                                                           | Luồng                                          |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `auth.spec.ts`, `auth-no-confirm.spec.ts`                                                                      | Auth (runner riêng `test:e2e:auth:no-confirm`) |
| `foundation.spec.ts`                                                                                           | Foundation                                     |
| `primary-navigation.spec.ts`, `internal-tab-navigation.spec.ts`                                                | Navigation                                     |
| `set-management.spec.ts`, `manual-set-creation.spec.ts`, `flashcard-set-ordering.spec.ts`                      | Sets                                           |
| `special-collections.spec.ts`, `quiz-result-collections.spec.ts`                                               | Collections                                    |
| `paste-import.spec.ts`, `document-import.spec.ts`, `document-auto-detection.spec.ts`, `unified-editor.spec.ts` | Import                                         |
| `pdf-runtime-isolation.spec.ts`                                                                                | PDF isolation                                  |
| `study-mode.spec.ts`                                                                                           | Study                                          |
| `quiz-advancement.spec.ts`, `learning-mode-setup.spec.ts`                                                      | Quiz                                           |
| `smart-review.spec.ts`, `new-cards.spec.ts`                                                                    | FSRS UI                                        |
| `match.spec.ts`, `memory.spec.ts`                                                                              | Games                                          |
| `mastery-summary.spec.ts`, `mastery-visuals.spec.ts`                                                           | Mastery                                        |
| `activity-calendar.spec.ts`                                                                                    | Statistics                                     |
| `profile-settings.spec.ts`                                                                                     | Profile                                        |
| `responsive-ui.spec.ts`, `mobile-first-ui.spec.ts`                                                             | Responsive                                     |
| `pagination.spec.ts`                                                                                           | Pagination                                     |
| `source-selection-scale.spec.ts`                                                                               | Scale source browser                           |

Runner: `scripts/test-e2e-local.mjs` — dựng local Supabase, chạy migration + seed,
bật mock env (`FLASHLEARN_CLASSIFIER_MOCK` etc.), webServer `npm run start`.

**Support:** `tests/e2e/support/auth-helpers.ts`, `supabase-api.ts`, `local-endpoints.ts`.

---

## 6. Scripts test khác

- `scripts/test-fsrs-local.mjs` (`npm run fsrs:test:local`) — test FSRS local.
- `scripts/test-production-pdf-isolation.mjs` / `test-production-pdf-worker.mjs`
  (`npm run test:pdf-runtime-isolation`, `test:pdf-worker-runtime`) — verify production
  PDF isolation (cần production guard).
- `scripts/fsrs-*.ts` — reconcile/compare/diagnose (không phải test thuần, là maintenance).

---

## 7. Map test theo feature

| Feature           | Unit                                   | Integration                           | DB (pgTAP)                    | E2E                                       |
| ----------------- | -------------------------------------- | ------------------------------------- | ----------------------------- | ----------------------------------------- |
| Auth              | ✅ `unit/features/auth`                | —                                     | `002_profiles`                | ✅ `auth*.spec.ts`                        |
| Import            | ✅ `unit/features/imports`             | —                                     | `007_import`                  | ✅ paste/document/unified-editor/pdf      |
| Sets              | ✅ `unit/features/flashcard-sets`      | —                                     | `003,008,013`                 | ✅ set-management/manual/ordering         |
| Collections       | ✅ `unit/features/special-collections` | —                                     | `004,009,010`                 | ✅ special-collections/result-collections |
| Study             | ✅ `unit/features/study`               | —                                     | —                             | ✅ study-mode                             |
| Quiz              | ✅ `unit/features/quiz`                | ✅ fsrs-shadow, card-scope            | `011,015,016,020,024,025`     | ✅ quiz-advancement/learning-mode-setup   |
| Smart Review      | ✅ `unit/features/smart-review`        | —                                     | `016` (origin)                | ✅ smart-review                           |
| Spaced Repetition | ✅ `unit/features/spaced-repetition`   | ✅ fsrs-reconciliation/due/direct-due | `014,016,017,018,019,020,021` | ✅ new-cards/smart-review                 |
| Mastery           | ✅ `unit/features/mastery`             | ✅ mastery-snapshot                   | —                             | ✅ mastery-summary/visuals                |
| Practice Coverage | ✅ `unit/features/practice-coverage`   | ✅ card-scope-mismatch                | `022,023,024`                 | (qua quiz/match/memory)                   |
| Learning Modes    | ✅ `unit/features/learning-modes`      | —                                     | —                             | ✅ learning-mode-setup                    |
| Match             | ✅ `unit/features/match`               | —                                     | —                             | ✅ match                                  |
| Memory            | ✅ `unit/features/memory`              | —                                     | —                             | ✅ memory                                 |
| Statistics        | ✅ `unit/features/statistics`          | —                                     | `012`                         | ✅ activity-calendar                      |
| Profile           | ✅ `unit/features/profile`             | —                                     | `011` (settings)              | ✅ profile-settings                       |
| Dashboard         | ✅ `unit/features/dashboard`           | —                                     | —                             | (qua navigation)                          |
| Source Selection  | ✅ `unit/features/source-selection`    | —                                     | —                             | ✅ source-selection-scale                 |

---

## 8. Vùng test mạnh / yếu

**Mạnh:**

- FSRS pipeline (unit + integration + pgTAP + scripts) — test rất dày.
- Quiz engine invariants (strict pool, coverage, origin) — pgTAP + integration.
- Import parsing (unit) + E2E document/paste.

**Yếu / thiếu:**

- RLS: kiểm tra chủ yếu qua pgTAP ownership tests; chưa có matrix RLS đầy đủ
  (insert/update/delete per policy) trong mọi bảng — nhưng coverage DB khá tốt.
- Streak: unit test utils/streak + E2E activity-calendar; RPC `get_learning_statistics`
  (logic streak trong SQL) được pgTAP `012` cover một phần.
- UI component tests ít (chỉ 4 files trong `unit/components`); phần lớn UI test qua E2E.
- Không có snapshot test lớn (đúng guideline).
- `tests/components/` trống (chỉ unit/components có file).

---

## 9. QA reports (`docs/QA/`)

Audit tài liệu trước đây: `AUTH_AUDIT.md`, `AUTH_FINAL_RETEST.md`,
`AUTH_GUEST_ROUTE_RETEST.md`, `AUTH_INTEGRATION_RECHECK.md`, `AUTH_PROXY_RETEST.md`,
`AUTH_SESSION_RETEST.md`, `CORE_DATABASE_AUDIT.md`, `FOUNDATION_AUDIT.md`,
`FOUNDATION_RETEST.md`, `MVP_RELEASE_AUDIT.md` — hữu ích để hiểu lịch sử hardening
auth và database.

---

## 10. Cách chạy

```bash
npm run check            # lint + typecheck + test + build
npm test                 # Vitest (unit + integration)
npm run test:e2e         # E2E (runner local, cần Docker + Supabase CLI)
npm run test:e2e:auth:no-confirm
npm run db:test          # pgTAP (cần supabase local chạy)
npm run fsrs:test:local
npm run test:pdf-runtime-isolation   # cần production guard
```
