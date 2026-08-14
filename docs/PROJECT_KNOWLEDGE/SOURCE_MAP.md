# SOURCE_MAP.md

> Index từ concept → source code. Khi cần tìm implementation của một concept:
> search file này trước. Mọi đường dẫn tính từ repo root.

---

## 1. Features

| Concept                      | Primary source                                                                                  | Related sources                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Authentication               | `src/features/auth/server/actions.ts`, `src/app/(app)/layout.tsx` (guard), `src/proxy.ts`       | `src/features/auth/` (toàn bộ), `src/lib/supabase/*`                                               |
| Import (Excel/CSV)           | `src/features/imports/`                                                                         | `supabase/migrations/20260805120000_add_atomic_flashcard_import.sql`                               |
| Import (Paste)               | `src/features/imports/server/analyze-paste.ts`, `utils/parse-paste.ts`                          | `adapters/paste-adapter.ts`, `gemini-provider.ts`                                                  |
| Import (Google Sheets)       | `src/features/imports/server/analyze-google-sheets.ts`, `utils/sheets-parser.ts`                | `adapters/google-sheets-adapter.ts`, `utils/public-sheets.ts`, `utils/sheets-a1.ts`                |
| Import (PDF/DOCX)            | `src/features/imports/server/extract-document.ts`, `generate-document-cards.ts`                 | `adapters/pdf-adapter.ts`, `docx-adapter.ts`, `utils/document-classifier.ts`, `section-builder.ts` |
| Flashcard sets CRUD          | `src/features/flashcard-sets/server/actions.ts`                                                 | `schemas/set-schema.ts`, `components/manual-set-form.tsx`, `set-reorder-list.tsx`                  |
| Flashcards (add/edit/delete) | `src/features/flashcard-sets/server/actions.ts` + RPC `add_flashcard`                           | `supabase/migrations/20260805130000`, `20260805140000`                                             |
| Special collections          | `src/features/special-collections/server/actions.ts`                                            | RPC `create_special_collection`, `set_card_collections`; migrations `2026080515…`, `2026080610…`   |
| Study                        | `src/features/study/`                                                                           | `study-source-select.tsx`, `study-session.tsx`, `utils/shuffle.ts`                                 |
| Quiz setup                   | `src/features/quiz/components/quiz-setup.tsx`                                                   | `source-selection/components/source-browser.tsx`, `learning-modes/components/*`                    |
| Quiz session                 | `src/features/quiz/components/quiz-session.tsx`                                                 | `src/features/quiz/server/actions.ts`                                                              |
| Quiz creation RPC            | `supabase/migrations/20260813010000_harden_strict_quiz_session_creation.sql`                    | lịch sử: `20260806110000`, `20260809120000`, `20260812200000`, `20260813000000`                    |
| Quiz answer RPC              | `supabase/migrations/20260810160000_populate_fsrs_rating_on_answer.sql`                         | `20260809120000` (event log)                                                                       |
| Quiz result                  | `src/app/(app)/quiz/[sessionId]/result/page.tsx`                                                | `src/features/quiz/utils/result-collection-targets.ts`                                             |
| Smart Review                 | `src/features/smart-review/`                                                                    | `spaced-repetition/server/due-repository.ts`, RPC `create_owned_quiz_session_from_card_ids`        |
| New Cards                    | `src/features/spaced-repetition/server/new-cards-repository.ts`                                 | RPC `load_new_card_candidates`, `start-new-cards-button.tsx`                                       |
| FSRS config                  | `src/features/spaced-repetition/config.ts`                                                      | `utils/rating-map.ts`                                                                              |
| FSRS reconcile               | `src/features/spaced-repetition/server/reconcile-card-schedule.ts`, `reconcile-orchestrator.ts` | `schedule-repository.ts`, `service-role-repository.ts`                                             |
| FSRS due repository          | `src/features/spaced-repetition/server/due-repository.ts`                                       | `types/due-types.ts`                                                                               |
| Mastery                      | `src/features/mastery/`                                                                         | `presentation/mastery-presentation.ts`                                                             |
| Practice coverage            | `src/features/practice-coverage/server/actions.ts`                                              | migrations `20260812190000`, `20260812200000`                                                      |
| Learning modes (filters)     | `src/features/learning-modes/types.ts`                                                          | `components/mode-filter.tsx`, `question-count-selector.tsx`                                        |
| Match                        | `src/features/match/`                                                                           | `match-setup.tsx`, `match-session.tsx`, `utils/match-session.ts`                                   |
| Memory                       | `src/features/memory/`                                                                          | `memory-session.tsx`, `utils/memory-session.ts`, `memory-grid-layout.ts`                           |
| Statistics                   | `src/features/statistics/`                                                                      | RPC `get_learning_statistics`, `utils/streak.ts`                                                   |
| Streak                       | `src/features/statistics/utils/streak.ts` + RPC                                                 | `daily_learning_records`                                                                           |
| Profile                      | `src/features/profile/`                                                                         | RPC `update_profile`, `constants/timezones.ts`                                                     |
| Dashboard                    | `src/features/dashboard/components/dashboard-learning-status.tsx`                               | `src/app/(app)/dashboard/page.tsx`                                                                 |
| Source selection             | `src/features/source-selection/`                                                                | `components/source-browser.tsx`, `server/load-source-page.ts`                                      |

---

## 2. Routes

| Route                         | File                                                |
| ----------------------------- | --------------------------------------------------- |
| `/`                           | `src/app/(marketing)/page.tsx`                      |
| `/sign-in`                    | `src/app/(auth)/sign-in/page.tsx`                   |
| `/sign-up`                    | `src/app/(auth)/sign-up/page.tsx`                   |
| `/check-email`                | `src/app/check-email/page.tsx`                      |
| `/auth/confirm`               | `src/app/auth/confirm/route.ts`                     |
| `/auth/error`                 | `src/app/auth/error/page.tsx`                       |
| `/dashboard`                  | `src/app/(app)/dashboard/page.tsx`                  |
| `/import`                     | `src/app/(app)/import/page.tsx`                     |
| `/sets`                       | `src/app/(app)/sets/page.tsx`                       |
| `/sets/[setId]`               | `src/app/(app)/sets/[setId]/page.tsx`               |
| `/collections`                | `src/app/(app)/collections/page.tsx`                |
| `/collections/[collectionId]` | `src/app/(app)/collections/[collectionId]/page.tsx` |
| `/quiz`                       | `src/app/(app)/quiz/page.tsx`                       |
| `/quiz/[sessionId]`           | `src/app/(app)/quiz/[sessionId]/page.tsx`           |
| `/quiz/[sessionId]/result`    | `src/app/(app)/quiz/[sessionId]/result/page.tsx`    |
| `/study`                      | `src/app/(app)/study/page.tsx`                      |
| `/study/session`              | `src/app/(app)/study/session/page.tsx`              |
| `/match`                      | `src/app/(app)/match/page.tsx`                      |
| `/match/session`              | `src/app/(app)/match/session/page.tsx`              |
| `/memory`                     | `src/app/(app)/memory/page.tsx`                     |
| `/memory/session`             | `src/app/(app)/memory/session/page.tsx`             |
| `/history`                    | `src/app/(app)/history/page.tsx`                    |
| `/statistics`                 | `src/app/(app)/statistics/page.tsx`                 |
| `/profile`                    | `src/app/(app)/profile/page.tsx`                    |
| `/settings`                   | `src/app/(app)/settings/page.tsx`                   |
| `/api/test/classifier-count`  | `src/app/api/test/classifier-count/route.ts`        |
| `/api/test/generation-count`  | `src/app/api/test/generation-count/route.ts`        |

---

## 3. Database tables

| Table                        | Migration gốc                                            | Related                                          |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `profiles`                   | `20260803215542_create_core_database.sql`                | trigger `handle_new_user`, RPC `update_profile`  |
| `flashcard_sets`             | cùng migration                                           | RPC `import_flashcard_set`, `move_flashcard_set` |
| `flashcards`                 | cùng migration                                           | RPC `add_flashcard`; index new cards             |
| `special_collections`        | cùng migration                                           | RPC `create_special_collection`                  |
| `special_collection_items`   | cùng migration                                           | RPC `set_card_collections`                       |
| `quiz_sessions`              | `20260806110000_add_quiz_engine.sql`                     | origin column (`20260810140000`)                 |
| `quiz_questions`             | cùng migration                                           | `source_flashcard_id` (`20260809120000`)         |
| `card_review_events`         | `20260809120000_add_card_review_events.sql`              | `fsrs_rating` (`20260810150000`)                 |
| `card_learning_schedule`     | `20260810150000_add_fsrs_schedule_projection.sql`        | RPC `upsert_card_learning_schedule`              |
| `flashcard_coverage`         | `20260812190000_add_learning_coverage.sql`               | RPC `complete_learning_coverage_session`         |
| `learning_coverage_sessions` | `20260812200000_make_learning_coverage_session_safe.sql` | RPC create/complete                              |
| `daily_learning_records`     | `20260806140000_secure_profile_timezone_changes.sql`     | RPC `submit_quiz_answer`                         |

---

## 4. RPC / Functions

| RPC                                                 | File migration (bản cuối)                                 | Caller                                            |
| --------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `create_quiz_session`                               | `20260813010000_harden_strict_quiz_session_creation.sql`  | `quiz/server/actions.ts` (`startQuiz`)            |
| `submit_quiz_answer`                                | `20260810160000_populate_fsrs_rating_on_answer.sql`       | `quiz/server/actions.ts`                          |
| `get_learning_statistics`                           | `20260806140000_secure_profile_timezone_changes.sql`      | `statistics/server/load-statistics.ts`            |
| `update_profile`                                    | `20260806140000_secure_profile_timezone_changes.sql`      | `profile/server/actions.ts`                       |
| `import_flashcard_set`                              | `20260807110000_add_flashcard_set_custom_order.sql`       | `imports/server/actions.ts`                       |
| `add_flashcard`                                     | `20260805130000_add_flashcard_to_set.sql`                 | `flashcard-sets/server/actions.ts`                |
| `move_flashcard_set`                                | `20260807110000_add_flashcard_set_custom_order.sql`       | `flashcard-sets/server/actions.ts`                |
| `create_special_collection`                         | `20260805150000_special_collections_memberships.sql`      | `special-collections/server/actions.ts`           |
| `set_card_collections`                              | `20260806100000_validate_collection_membership_input.sql` | `special-collections/server/actions.ts`           |
| `complete_learning_coverage_session`                | `20260812200000_make_learning_coverage_session_safe.sql`  | `practice-coverage/server/actions.ts`             |
| `load_new_card_candidates`                          | `20260810180000_harden_new_cards_read_model.sql`          | dashboard, new-cards UI                           |
| `create_owned_quiz_session_from_card_ids`           | `20260810140000_add_quiz_session_origin.sql`              | `smart-review/server/actions.ts` (admin)          |
| `create_owned_quiz_session_from_card_ids_new_cards` | `20260810170000_add_new_cards_origin.sql`                 | new-cards UI (admin)                              |
| `upsert_card_learning_schedule`                     | `20260810150000_add_fsrs_schedule_projection.sql`         | `spaced-repetition/server/reconcile-*.ts` (admin) |
| `create_learning_coverage_session`                  | `20260812200000_make_learning_coverage_session_safe.sql`  | match/memory/quiz (admin)                         |
| `handle_new_user`                                   | `20260803215542_create_core_database.sql`                 | trigger auth.users                                |
| `set_updated_at`                                    | cùng migration                                            | trigger các bảng                                  |
| `set_quiz_session_origin`                           | `20260810140000_add_quiz_session_origin.sql`              | trigger quiz_sessions                             |

---

## 5. Shared services

| Service                         | File                                     |
| ------------------------------- | ---------------------------------------- |
| Supabase browser client         | `src/lib/supabase/client.ts`             |
| Supabase server client          | `src/lib/supabase/server.ts`             |
| Supabase admin (service role)   | `src/lib/supabase/admin.ts`              |
| Supabase proxy (cookie refresh) | `src/lib/supabase/proxy.ts`              |
| Production project guard        | `src/lib/supabase/production-project.ts` |
| Database types (generated)      | `src/lib/supabase/types.ts`              |
| Env validation                  | `src/lib/env.ts`                         |
| Constants (limits)              | `src/lib/constants.ts`                   |
| Logger                          | `src/lib/logger.ts`                      |
| Content normalization           | `src/lib/normalize-content.ts`           |
| Pagination helper               | `src/lib/pagination.ts`                  |
| `cn()`                          | `src/lib/utils.ts`                       |
| Mutation error helper           | `src/lib/mutation-error.ts`              |
| App shell / nav                 | `src/components/layout/*`                |

---

## 6. Config

| Config                      | File                                                           |
| --------------------------- | -------------------------------------------------------------- |
| package.json (scripts/deps) | `package.json`                                                 |
| Next.js                     | `next.config.ts`                                               |
| TypeScript                  | `tsconfig.json`                                                |
| ESLint                      | `eslint.config.mjs`                                            |
| Prettier                    | `.prettierrc.json`                                             |
| Vitest                      | `vitest.config.mts`                                            |
| Playwright                  | `playwright.config.ts`, `playwright.auth-no-confirm.config.ts` |
| Tailwind (CSS-first)        | `src/app/globals.css`                                          |
| shadcn/ui                   | `components.json`                                              |
| Husky                       | `.husky/pre-commit`                                            |
| Supabase local              | `supabase/config.toml`                                         |
| Env template                | `.env.example`                                                 |

---

## 7. Tests

| Layer            | Location                     |
| ---------------- | ---------------------------- |
| Unit/component   | `tests/unit/`                |
| Integration      | `tests/integration/`         |
| E2E              | `tests/e2e/` (+ `support/`)  |
| Database (pgTAP) | `supabase/tests/`            |
| E2E runner       | `scripts/test-e2e-local.mjs` |
| FSRS scripts     | `scripts/fsrs-*.ts`          |
| QA reports       | `docs/QA/`                   |
