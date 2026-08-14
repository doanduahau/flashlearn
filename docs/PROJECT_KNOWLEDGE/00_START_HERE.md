# 00 — Bắt đầu tại đây (Start Here)

> Tài liệu này là **lối vào duy nhất** dành cho AI coding agent hoặc developer mới làm việc trong FlashLearn.
> Đọc toàn bộ file này trước, sau đó đọc `AI_HANDOFF.md` và các tài liệu liên quan trước khi sửa code.

## Metadata (Knowledge snapshot)

| Mục                         | Giá trị                                    |
| --------------------------- | ------------------------------------------ |
| Repository                  | FlashLearn                                 |
| Documentation snapshot date | 2026-08-13                                 |
| Git branch                  | `main`                                     |
| Git commit SHA              | `57da3a0b9c52957e79693b8b3052e4e1e3a3d753` |
| Package version             | `0.1.0` (package.json)                     |
| Knowledge snapshot          | `57da3a0`                                  |

> Bộ tài liệu này mô tả đúng trạng thái repository tại commit trên. Nếu làm việc ở commit khác, hãy kiểm tra lại các phần có thể đã đổi.

---

## 1. Project identity

**FlashLearn là gì:** Một nền tảng web học tập biến nội dung dạng hai cột (Excel/CSV, văn bản dán, Google Sheets, tài liệu DOCX/PDF) thành bộ flashcard và bài kiểm tra.

**Problem mà sản phẩm giải quyết:** Người dùng có tài liệu học (bảng từ vựng, câu hỏi ôn tập, tài liệu lý thuyết) nhưng tốn thời gian thủ công chuyển thành thẻ học và bài kiểm tra. FlashLearn tự động hóa việc tạo thẻ và cung cấp nhiều chế độ học/kiểm tra.

**Target use cases:**

- Học ngoại ngữ (từ vựng, mẫu câu).
- Ôn thi kiến thức phổ thông, chuyên ngành (lập trình, công thức, luật, y khoa).
- Luyện câu hỏi phỏng vấn.
- Bất kỳ nội dung hỏi–đáp biểu diễn được bằng hai cột.

**Core value proposition:** “Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh” — mở rộng thực tế sang nhiều nguồn nhập (paste, Google Sheets, DOCX, PDF) và nhiều chế độ học (study, quiz, match, memory, smart review, new cards).

---

## 2. Current product state

> ⚠️ Trạng thái thực tế đã **vượt xa MVP mô tả trong `AGENTS.md`**. Danh sách dưới đây là các capability **đã kiểm chứng trong source code**.

### Đã implement (verified)

| Domain                     | Trạng thái                                                                                             | Vị trí chính                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Authentication             | ✅ Đầy đủ: sign-up (email confirm), sign-in, sign-out, session cookies, route protection 2 lớp         | `src/features/auth/`, `src/proxy.ts`, `src/lib/supabase/`                                                                     |
| Import Excel/CSV           | ✅ Parsing client-side, mapping cột, preview, import atomic                                            | `src/features/imports/adapters/excel-adapter.ts`, `server/actions.ts`                                                         |
| Import Paste               | ✅ TSV / Q:A / Term:Definition + AI (Gemini) khi là prose                                              | `src/features/imports/adapters/paste-adapter.ts`                                                                              |
| Import Google Sheets       | ✅ Public (API key) + private (OAuth access token, Picker)                                             | `src/features/imports/adapters/google-sheets-adapter.ts`, `server/analyze-google-sheets.ts`, `utils/public-sheets.ts`         |
| Import DOCX/PDF            | ✅ Extraction (mammoth, pdf-parse), auto-classification, AI generation (Gemini)                        | `src/features/imports/adapters/docx-adapter.ts`, `pdf-adapter.ts`, `server/analyze-document.ts`, `generate-document-cards.ts` |
| Unified draft editor       | ✅ Edit/reorder (dnd-kit)/swap thẻ trước khi import                                                    | `src/features/imports/components/unified-draft-editor.tsx`                                                                    |
| Manual set creation        | ✅ Form modal tạo bộ bằng tay                                                                          | `src/features/flashcard-sets/components/manual-set-form.tsx`                                                                  |
| Flashcard sets CRUD        | ✅ Rename, delete, add/edit/delete card, search, pagination, reorder sets                              | `src/features/flashcard-sets/`                                                                                                |
| Special collections        | ✅ CRUD + membership sync idempotent                                                                   | `src/features/special-collections/`                                                                                           |
| Study mode                 | ✅ Flashcard flip, keyboard, swipe, shuffle seed, membership trong phiên                               | `src/features/study/`                                                                                                         |
| Quiz engine                | ✅ Server-owned session, 4 mode (balanced/never_tested/wrong_answers/pure_random), snapshot, resumable | `src/features/quiz/`, `supabase/migrations/20260806110000_add_quiz_engine.sql`                                                |
| Quiz coverage cycle        | ✅ `flashcard_coverage` + `learning_coverage_sessions` (commit khi hoàn thành, reset theo scope)       | `src/features/practice-coverage/`, migration `20260812190000`/`20260812200000`                                                |
| Statistics & streak        | ✅ RPC `get_learning_statistics`, `daily_learning_records`, calendar, timezone                         | `src/features/statistics/`, `src/features/profile/`                                                                           |
| Mastery V1                 | ✅ Confidence projection (untested/review/learning/strong) từ `card_review_events`                     | `src/features/mastery/`                                                                                                       |
| FSRS (spaced repetition)   | ✅ FSRS-6 projection `card_learning_schedule`, reconciliation, CAS RPC, due read model                 | `src/features/spaced-repetition/`, migration `20260810150000`                                                                 |
| Smart Review               | ✅ FSRS-due based, tạo quiz session origin `smart_review` qua service-role                             | `src/features/smart-review/`                                                                                                  |
| New Cards                  | ✅ “Thẻ mới thật sự” = chưa có schedule + chưa có review event; origin `new_cards`                     | `src/features/spaced-repetition/`, migration `20260810170000`/`20260810180000`                                                |
| Match mode                 | ✅ Front→Back, 6 pairs/batch, b-matching, coverage `match`                                             | `src/features/match/`                                                                                                         |
| Memory mode                | ✅ Flip & match, adaptive grid, coverage `memory`                                                      | `src/features/memory/`                                                                                                        |
| Profile settings           | ✅ Display name, timezone (cooldown 72h), local-time preview                                           | `src/features/profile/`                                                                                                       |
| Shared learning-mode setup | ✅ ModeFilter (Chưa làm/Câu sai/Ngẫu nhiên), QuestionCountSelector, StickyStartBar, SourceBrowser      | `src/features/learning-modes/`, `src/features/source-selection/`                                                              |

### Chưa implement / placeholder

| Item                                                                                                                                                                                                                                                                                                 | Trạng thái                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Flashcard Runner (`/runner`)                                                                                                                                                                                                                                                                         | Chưa có — chỉ là “Sắp ra mắt” trên `/study?tab=play` (`src/app/(app)/study/page.tsx`) |
| `src/features/streak/`, `src/features/analytics/`, `src/features/dashboard/` (ngoài component), `src/features/flashcards/`, `src/features/flashcard-sets` (một phần), `src/features/study/`, `src/features/quiz/`, `src/features/imports/`, `src/features/special-collections/` (`.gitkeep` còn lại) | Feature folder rỗng / chưa dùng                                                       |
| Auth: đổi email, đổi mật khẩu, avatar, xóa tài khoản, OAuth                                                                                                                                                                                                                                          | Ngoài scope — `docs/AUTH.md` liệt kê là deferred                                      |
| Spaced repetition hiển thị nâng cao (SM-2, UI sắp lịch)                                                                                                                                                                                                                                              | FSRS là hạ tầng; UI chỉ có Smart Review/New Cards counts                              |

---

## 3. Technology snapshot

Xác minh từ `package.json` (13/08/2026):

| Công nghệ                          | Version                                                   | Ghi chú                                                                  |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Next.js                            | `16.3.0`                                                  | App Router; dùng `src/proxy.ts` (Next 16 proxy thay middleware cũ)       |
| React / React DOM                  | `19.2.4`                                                  |                                                                          |
| TypeScript                         | `^5`                                                      | `strict: true`                                                           |
| Tailwind CSS                       | `^4`                                                      | `@tailwindcss/postcss`; tokens trong `src/app/globals.css`               |
| shadcn/ui                          | components.json (style `new-york`)                        | Chỉ có `button`, `input`, `label`, `textarea` + `dialog-overlay` tự viết |
| Supabase JS + SSR                  | `@supabase/supabase-js ^2.112.0`, `@supabase/ssr ^0.12.4` |                                                                          |
| Zod                                | `^4.4.3`                                                  | Validation boundary                                                      |
| ts-fsrs                            | `5.4.1`                                                   | FSRS-6 scheduler                                                         |
| SheetJS (`xlsx`)                   | `0.20.3` (tarball CDN)                                    | Import Excel/CSV                                                         |
| mammoth                            | `^1.12.1`                                                 | DOCX extraction                                                          |
| pdf-parse                          | `^2.4.5`                                                  | PDF extraction (serverExternalPackages)                                  |
| @napi-rs/canvas                    | `0.1.80`                                                  | PDF text-extraction runtime dependency                                   |
| @google/genai                      | `^2.16.0`                                                 | Gemini: classification + generation (model `gemini-flash-lite-latest`)   |
| @dnd-kit/core, sortable, utilities | `^6.3.1`, `^10.0.0`, `^3.2.2`                             | Drag-drop editor                                                         |
| Vitest                             | `^4.1.10`                                                 | jsdom, setup `tests/setup.ts`                                            |
| Playwright                         | `^1.62.1`                                                 | E2E, 1 worker, chromium                                                  |
| Supabase CLI                       | `^2.111.0`                                                | Local dev, pgTAP tests                                                   |
| lucide-react                       | `^1.28.0`                                                 | Icons                                                                    |

---

## 4. Architecture in one page

```
Browser (Next.js Client Components)
   ↓  server actions ("use server") / route handlers / Server Components
Next.js App Router (src/app)
   ↓  feature modules (src/features/<feature>)
   ↓    ├─ schemas/  → Zod validation tại boundary
   ↓    ├─ server/   → server actions, repositories, orchestrators
   ↓    └─ utils/    → pure domain logic
   ↓  Supabase clients (publishable anon key, or admin service-role cho RPC private)
PostgreSQL + Row Level Security (supabase/migrations)
```

Chi tiết:

- **Server-first:** Server Components mặc định; `"use client"` chỉ ở component tương tác (flip, form, game board).
- **Mutations** đi qua server actions → Zod schema → Supabase RPC (nhiều RPC là `SECURITY DEFINER`, owner suy từ `auth.uid()`).
- **Browser không bao giờ nhận/quyết định** `user_id`, position, điểm số, đáp án đúng (trước khi submit), FSRS state.
- **Database là boundary cuối:** constraints, composite FKs, RLS, trigger origin, CAS revision.

Xem [03_ARCHITECTURE.md](./03_ARCHITECTURE.md).

---

## 5. Major directories

| Thư mục                | Vai trò                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app/`             | Routes: `(marketing)`, `(auth)`, `(app)` (protected), `api/test/*` (test-only), `auth/confirm`       |
| `src/features/`        | Feature-first modules — **code nghiệp vụ nằm ở đây**                                                 |
| `src/components/`      | `ui/` (shadcn primitives), `layout/` (app shell/nav), `shared/` (tabs, pagination)                   |
| `src/lib/`             | `env.ts`, supabase clients (`client`/`server`/`admin`/`proxy`), constants, logger, pagination, utils |
| `src/proxy.ts`         | Next.js 16 proxy: refresh session + route protection                                                 |
| `supabase/migrations/` | **Nguồn sự thật schema** (23 migrations, đọc theo thứ tự)                                            |
| `supabase/tests/`      | pgTAP tests (25 file)                                                                                |
| `supabase/seed.sql`    | Trống (không seed fake users)                                                                        |
| `tests/`               | `unit/`, `integration/`, `e2e/`, `fixtures/`                                                         |
| `scripts/`             | E2E runner, FSRS reconcile/compare/diagnose runners                                                  |
| `docs/`                | Tài liệu cũ + `docs/PROJECT_KNOWLEDGE/` (bộ tài liệu này)                                            |

---

## 6. Most important domain entities

```
auth.users (Supabase Auth)
  ├── profiles                      (1:1, tạo bởi trigger handle_new_user)
  ├── flashcard_sets                (1:N)  ── sort_order cho thứ tự tùy chỉnh
  │     └── flashcards              (1:N, composite FK giữ ownership)
  ├── special_collections           (1:N)  ── tên unique (user_id, lower(name))
  │     └── special_collection_items (M:N giữa collections ↔ flashcards)
  ├── quiz_sessions                 (1:N)  ── origin: manual|smart_review|new_cards
  │     └── quiz_questions          (snapshot prompt/choices/answer)
  ├── card_review_events            (append-only learning facts, fsrs_rating)
  ├── card_learning_schedule        (FSRS-6 projection, rebuildable, CAS)
  ├── daily_learning_records        (immutable local dates cho streak/statistics)
  ├── flashcard_coverage            (mode-specific coverage: quiz|match|memory|runner)
  └── learning_coverage_sessions    (snapshot session/scope cho coverage idempotent)
```

Quan hệ đầy đủ + ERD: [05_DATABASE.md](./05_DATABASE.md). Domain concept: [02_PRODUCT_AND_DOMAIN.md](./02_PRODUCT_AND_DOMAIN.md).

---

## 7. Golden rules

Các constraint mà agent sửa code **tuyệt đối phải biết** (kèm evidence):

1. **Không bao giờ tin `user_id` từ client.** Ownership luôn suy từ `auth.uid()` (JWT sub) trong RPC/RLS. (`src/features/*/server/actions.ts`, migrations)
2. **Browser không ghi trực tiếp bảng lõi.** INSERT/UPDATE trên `flashcard_sets`, `flashcards`, `special_collections`, `special_collection_items`, `profiles`, `quiz_sessions`, `quiz_questions`, `card_review_events`, `card_learning_schedule`, `daily_learning_records`, `flashcard_coverage` đều bị thu hẹp hoặc revoke; viết qua RPC scoped. (`20260805140000`, `20260805150000`, `20260806130000`, `20260812200000`, ...)
3. **Composite FK là backstop ownership:** `(user_id, set_id)` → `flashcard_sets(user_id, id)`, `(user_id, collection_id)`, `(user_id, flashcard_id)`. Không tạo FK đơn cho entity owned. (`20260803215542`)
4. **Quiz question là snapshot bất biến.** Sửa flashcard gốc không đổi lịch sử. `quiz_questions.source_flashcard_id` giữ identity khi card bị xóa. (`20260809120000`)
5. **`card_review_events` là append-only**, nguồn sự thật cho Mastery và FSRS. Không sửa/xóa event trong product flow. `fsrs_rating`: 1=Again, 3=Good khi trả lời quiz. (`20260809120000`, `20260810160000`)
6. **FSRS config là immutable:** `flashlearn-v1` (ts-fsrs 5.4.1, `w` cố định). Đổi bất kỳ tham số scheduling nào phải dùng parameter-set mới. (`src/features/spaced-repetition/config.ts`)
7. **Projection ghi qua CAS RPC duy nhất** `upsert_card_learning_schedule` (service-role). Browser không có quyền. Revision `projection_revision` không bao giờ tự hạ. (`20260810150000`)
8. **Quiz origin là immutable** qua trigger `quiz_sessions_set_origin`; chỉ wrapper service-role đặt `smart_review`/`new_cards` qua `set_config`. (`20260810140000`, `20260810170000`)
9. **Coverage chỉ commit khi session hoàn thành**, idempotent, reset theo scope khi scope phủ đầy. Tạo coverage session chỉ service-role. (`20260812190000`, `20260812200000`, `src/features/practice-coverage/server/actions.ts`)
10. **Strict pools không bao giờ backfill:** filter Chưa làm / Câu sai giữ đúng pool (uncovered / wrong-history) — server + DB đều enforce. (`20260813000000`, `src/features/learning-modes/types.ts`)
11. **`daily_learning_records` bất biến:** ngày địa phương snapshot lúc hoàn thành quiz; đổi timezone không rewrite lịch sử; cooldown 72h. (`20260806140000`)
12. **Source selection: all XOR sets XOR collections** (không trộn sets + collections), tối đa 50 nguồn. (`quiz-schema.ts`, migrations)
13. **Import: max 5MB / 2000 thẻ** (file), **15MB / 100k ký tự / 200 trang** (document). Không lưu file gốc. Server re-validate toàn bộ payload. (`src/lib/constants.ts`, `import-schema.ts`, `import_flashcard_set`)
14. **Match/Memory không ghi graded data:** không tạo quiz_sessions, review events, FSRS, streak, statistics. Chỉ coverage. (`docs/LEARNING_MODES.md`, match/memory server actions)
15. **RLS phải được thêm khi thêm bảng owned**; không dựa filter client. (`AGENTS.md` §9, `20260803215542`)
16. **Không sửa migration đã apply.** Thêm migration mới. (`AGENTS.md` §23)
17. **`npm run check` phải xanh** (lint + typecheck + unit test + build) trước khi hoàn thành task.
18. **Không dùng `ORDER BY random()` làm chiến lược chính** cho Balanced; deterministic ordering qua MD5. (`20260806110000`)
19. **Gemini chỉ fallback:** structured content (bảng 2 cột, TSV, Q:A) không gọi AI. Giới hạn: 10 classify + 10 generate/document, 1 attempt. (`src/features/imports/adapters/*`)
20. **Test-only routes `/api/test/*` phải 404 khi mock env không bật** — RELEASE BLOCKER nếu bật trong production. (`src/app/api/test/*`, `docs/DEPLOYMENT.md`)

---

## 8. Where to look

| Muốn sửa                                  | Đọc trước                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quiz engine (selection, answer, snapshot) | `supabase/migrations/20260806110000_add_quiz_engine.sql`, `20260813000000`, `20260813010000`; `src/features/quiz/server/actions.ts`, `schemas/quiz-schema.ts`, `components/quiz-setup.tsx` |
| Quiz UI setup (filter/count/source)       | `src/features/learning-modes/`, `src/features/source-selection/`, `src/features/quiz/components/quiz-setup.tsx`                                                                            |
| FSRS / spaced repetition                  | `src/features/spaced-repetition/` (config, reconcile-orchestrator, due-repository, schedule-repository), `20260810150000`                                                                  |
| Smart Review                              | `src/features/smart-review/`, `20260810120000..10140000`, `due-repository.ts`                                                                                                              |
| New Cards                                 | `src/features/spaced-repetition/server/new-cards-repository.ts`, `20260810170000`, `20260810180000`                                                                                        |
| Mastery                                   | `src/features/mastery/` (derive-flashcard-mastery, load-*), `20260809120000`                                                                                                               |
| Coverage                                  | `src/features/practice-coverage/`, `20260812190000`, `20260812200000`, `20260813010000`                                                                                                    |
| Import (Excel/CSV/Paste/Sheets/Document)  | `src/features/imports/` (adapters, server, utils, schemas), `20260805120000`                                                                                                               |
| Database / migrations / RLS               | `supabase/migrations/` (theo thứ tự), `supabase/tests/`, `docs/DATABASE.md`                                                                                                                |
| Auth                                      | `src/features/auth/`, `src/proxy.ts`, `src/lib/supabase/*`, `docs/AUTH.md`                                                                                                                 |
| Study mode                                | `src/features/study/`, `docs/STUDY.md`                                                                                                                                                     |
| Match / Memory                            | `src/features/match/`, `src/features/memory/`, `docs/LEARNING_MODES.md`                                                                                                                    |
| Statistics / streak / calendar            | `src/features/statistics/`, `20260806120000`, `20260806140000`, `src/lib/supabase/types.ts` (generated)                                                                                    |
| Profile / timezone                        | `src/features/profile/`, `20260806130000`, `20260806140000`                                                                                                                                |
| Flashcard sets / collections CRUD         | `src/features/flashcard-sets/`, `src/features/special-collections/`                                                                                                                        |
| UI / design tokens                        | `src/app/globals.css`, `src/components/`, `10_UI_DESIGN_SYSTEM.md`                                                                                                                         |
| E2E / test infrastructure                 | `tests/e2e/`, `scripts/test-e2e-local.mjs`, `11_TESTING_AND_QA.md`                                                                                                                         |
| Deploy / env                              | `docs/DEPLOYMENT.md`, `12_RUNTIME_AND_DEPLOYMENT.md`, `src/lib/env.ts`                                                                                                                     |

---

## 9. Suggested reading order

1. `00_START_HERE.md` (file này)
2. `AI_HANDOFF.md` — protocol làm việc + change impact map
3. `03_ARCHITECTURE.md` — kiến trúc + diagrams
4. `05_DATABASE.md` — schema, RLS, RPC (nguồn sự thật)
5. `02_PRODUCT_AND_DOMAIN.md` — domain model
6. Feature liên quan task trong `07_FEATURES.md` + `SOURCE_MAP.md`
7. Source code thực tế (luôn kiểm tra lại trước khi đổi)

---

## 10. Documentation status

Trạng thái drift giữa tài liệu cũ và implementation hiện tại (chi tiết: [15_TECH_DEBT_AND_RISKS.md](./15_TECH_DEBT_AND_RISKS.md#documentation-drift)):

| Nguồn                                                                                             | Mức độ khớp với code                                                            | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                                                       | ⚠️ **Lỗi thời một phần**                                                        | Blueprint MVP. Code đã vượt MVP: có quiz coverage, Match, Memory, FSRS, Smart Review, New Cards, document import, Google Sheets, paste import, manual sets, set reorder, mastery. Route map trong AGENTS khác thực tế (`/quiz/[sessionId]` không phải `/quiz/[attemptId]`, có `/match`, `/memory`, `/profile`...). `MIN_QUIZ_QUESTIONS = 10` trong AGENTS nhưng thực tế quiz manual cho phép 1..100 (strict migration). |
| `README.md`                                                                                       | ✅ Khá khớp                                                                     | Đã cập nhật các feature chính (quiz, statistics, sets, collections, study, settings).                                                                                                                                                                                                                                                                                                                                   |
| `docs/ARCHITECTURE.md`                                                                            | ⚠️ Lỗi thời một phần                                                            | Mô tả đúng nền tảng nhưng thiếu quiz engine chi tiết, coverage, FSRS, match/memory, import mở rộng.                                                                                                                                                                                                                                                                                                                     |
| `docs/DATABASE.md`                                                                                | ✅ Khá khớp                                                                     | Đã ghi quiz, review events, mastery, smart review, FSRS, coverage, new cards. Thiếu bảng `learning_coverage_sessions`, `flashcard_coverage` chi tiết (có ghi), thiếu strict quiz eligibility.                                                                                                                                                                                                                           |
| `docs/QUIZ.md`, `docs/STUDY.md`, `docs/STATISTICS.md`, `docs/LEARNING_MODES.md`, `docs/IMPORT.md` | ✅ Khá khớp                                                                     | Đây là các tài liệu feature mới nhất, được cập nhật song song code.                                                                                                                                                                                                                                                                                                                                                     |
| `docs/ROUTES.md`                                                                                  | ✅ Khá khớp                                                                     | Đúng hầu hết route hiện tại; thiếu `/api/test/*` và note `/profile?tab=statistics` là trang thống kê chính.                                                                                                                                                                                                                                                                                                             |
| `docs/AUTH.md`                                                                                    | ✅ Khớp                                                                         |                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/DEPLOYMENT.md`                                                                              | ⚠️ Migration head ghi `20260810180000` nhưng thực tế đã có tới `20260813010000` | Cần cập nhật nếu deploy lại.                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/DECISIONS/`                                                                                 | ✅ Khớp                                                                         | 001 (ownership), 002 (free-tier beta).                                                                                                                                                                                                                                                                                                                                                                                  |

**Quy tắc khi đọc tài liệu:** Khi tài liệu và code mâu thuẫn, ưu tiên: migrations → source code → tests → runtime/config → docs feature mới → README → AGENTS.md.

---

## 11. Feature dependency matrix (tóm tắt)

Chi tiết + Mermaid: [03_ARCHITECTURE.md](./03_ARCHITECTURE.md#feature-dependency-map) và [07_FEATURES.md](./07_FEATURES.md).

| Feature             | Depends on                                                                                 | Used by                                                   | Tables                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| imports             | auth, lib/constants, Gemini adapters                                                       | flashcard-sets (tạo set)                                  | `flashcard_sets`, `flashcards`                                                                     |
| flashcard-sets      | auth, imports (RPC), special-collections (control)                                         | dashboard, study, quiz, match, memory, source-selection   | `flashcard_sets`, `flashcards`                                                                     |
| special-collections | auth                                                                                       | sets detail, study session, quiz result, source-selection | `special_collections`, `special_collection_items`                                                  |
| study               | auth, special-collections, source-selection                                                | —                                                         | read-only                                                                                          |
| quiz                | auth, practice-coverage, spaced-repetition (FSRS shadow), learning-modes, source-selection | smart-review, new-cards (reuse session), result page      | `quiz_sessions`, `quiz_questions`, `card_review_events`, `daily_learning_records`, coverage tables |
| smart-review        | spaced-repetition (due), quiz (session creation), mastery (bầu chọn cũ)                    | dashboard, result continuation                            | `card_learning_schedule` (read), `quiz_sessions`                                                   |
| spaced-repetition   | auth, quiz (review events)                                                                 | smart-review, dashboard, new-cards                        | `card_review_events`, `card_learning_schedule`                                                     |
| mastery             | auth, card_review_events                                                                   | sets/collection detail, (Smart Review legacy)             | `card_review_events` (read)                                                                        |
| match / memory      | auth, learning-modes, practice-coverage, source-selection                                  | study page                                                | `flashcard_coverage`, `learning_coverage_sessions`                                                 |
| statistics / streak | auth, quiz (completed sessions), profile (timezone)                                        | dashboard, profile                                        | `daily_learning_records`, `quiz_sessions` (read), `profiles`                                       |
| practice-coverage   | auth                                                                                       | quiz, match, memory                                       | `flashcard_coverage`, `learning_coverage_sessions`                                                 |

---

## 12. Nguồn kiểm chứng nhanh

- Toàn bộ feature → [07_FEATURES.md](./07_FEATURES.md)
- Concept → source code → [SOURCE_MAP.md](./SOURCE_MAP.md)
- Glossary (tránh nhầm khái niệm) → [16_GLOSSARY.md](./16_GLOSSARY.md)
- Risks / tech debt → [15_TECH_DEBT_AND_RISKS.md](./15_TECH_DEBT_AND_RISKS.md)
