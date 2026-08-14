# 01 — Project Overview

> Tổng quan sản phẩm ở mức chiến lược. Nguồn: `AGENTS.md` (blueprint), README, code hiện tại, docs feature. Đánh dấu rõ điều gì là **đã implement** vs **chỉ trên giấy**.

## 1. Product vision

FlashLearn biến bất kỳ nội dung học dạng cặp dữ liệu (câu hỏi–đáp, thuật ngữ–định nghĩa) thành một hệ thống học cá nhân: bộ flashcard, bài kiểm tra trắc nghiệm, và các chế độ luyện tập tương tác (Match, Memory). Thiết kế hướng đến cảm giác “chăm sóc khu vườn kiến thức” (Soft Green Learning Garden) — thân thiện, mát mắt, không giống dashboard doanh nghiệp.

## 2. Problem statement

- Học viên có tài liệu dạng bảng/cột (từ vựng, Q&A, công thức) nhưng việc chuyển thành thẻ học + bài test là thủ công.
- Tài liệu dạng văn xuôi (DOCX/PDF) khó tự tạo thẻ.
- Các hệ thống flashcard cũ (file Excel thuần) thiếu vòng lặp kiểm tra, thống kê, chuỗi học tập.

FlashLearn giải quyết: **một nơi duy nhất để nhập nội dung → tạo bộ → học → kiểm tra → theo dõi tiến độ.**

## 3. Main user persona / use cases

| Persona                          | Use case chính                                                              |
| -------------------------------- | --------------------------------------------------------------------------- |
| Người học ngoại ngữ              | Import bảng từ vựng, học flashcard, làm quiz, theo dõi streak               |
| Sinh viên ôn thi                 | Import câu hỏi ôn tập (Q/A), quiz theo chế độ “Câu sai”, xem thống kê       |
| Người học lập trình / chuyên môn | Import kiến thức, Mastery hiển thị trạng thái nhớ, Smart Review thẻ đến hạn |
| Người có tài liệu dạng văn bản   | Paste hoặc upload DOCX/PDF, để FlashLearn phân loại + sinh thẻ (Gemini)     |

## 4. Main capabilities (tổng hợp)

1. **Nhập liệu đa nguồn:** Excel/CSV (5MB, browser-only parse), paste văn bản (TSV/Q:A/term-def + AI), Google Sheets (public + private OAuth), DOCX/PDF (15MB, extract → classify → generate), tạo tay (manual).
2. **Editor thống nhất (Unified Draft Editor):** sửa, xóa, thêm, kéo-thả sắp xếp, đảo front/back trước khi import atomic.
3. **Quản lý bộ & thẻ:** rename, delete, add/edit/delete card, search + pagination, sắp xếp bộ (sort_order), membership bộ đặc biệt.
4. **Bộ đặc biệt:** gom thẻ xuyên bộ không copy nội dung; tên unique per-user; sync idempotent.
5. **Study mode:** lật thẻ, bàn phím, swipe, shuffle seeded, thêm/bớt bộ đặc biệt trong phiên; không ghi history.
6. **Quiz engine:** server-owned sessions, snapshot bất biến, 4 chế độ chọn (balanced/never_tested/wrong_answers/pure_random), strict pools, resumable, result + collections control, history.
7. **Coverage cycle:** mỗi mode (quiz/match/memory/runner) theo dõi thẻ đã phủ; chỉ reset khi phủ đầy scope; “Chưa làm”/“Câu sai” là strict pools.
8. **Mastery V1:** trạng thái confidence (untested/review/learning/strong) từ lịch sử review.
9. **FSRS-6 (spaced repetition):** projection `card_learning_schedule`, reconciliation CAS, due read model.
10. **Smart Review:** quiz từ các thẻ FSRS due (origin `smart_review`), continuation trên result page.
11. **New Cards:** batch thẻ chưa từng học (origin `new_cards`).
12. **Match:** ghép Front–Back, 12/18/24 câu, b-matching, coverage `match`.
13. **Memory:** lật tile ghép cặp, adaptive grid, coverage `memory`.
14. **Statistics & streak:** streak hiện tại/dài nhất, calendar hoạt động, accuracy, mode breakdown, recent quizzes, theo timezone.
15. **Profile settings:** display name, timezone (cooldown 72h), local-time preview.

## 5. Current scope

- **Platform:** Next.js 16 + Supabase (PostgreSQL 15, Auth, RLS), deploy Vercel Hobby + Supabase Free (ADR 002).
- **Ngôn ngữ UI:** Tiếng Việt (locale `vi`).
- **Phạm vi dữ liệu:** mọi bảng owned theo user; không có dữ liệu shared/public.
- **Không lưu file gốc import**; không render HTML từ Excel; không thực thi macro/công thức.

## 6. Implemented vs Partially vs Planned vs Out-of-scope

### Implemented (đầy đủ, có test)

| Feature                                               | Evidence                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Auth (email/password + confirm, session, proxy guard) | `src/features/auth/`, `tests/e2e/auth.spec.ts`                                                            |
| Import Excel/CSV                                      | `src/features/imports/`, `tests/e2e/set-management.spec.ts`                                               |
| Import Paste                                          | `paste-import.spec.ts`, `parse-paste.ts`                                                                  |
| Import Google Sheets (public + private)               | `google-sheets-import.tsx`, `analyze-google-sheets.ts`, `public-sheets.ts`                                |
| Import DOCX/PDF (extract + classify + generate)       | `document-import.spec.ts`, `document-auto-detection.spec.ts`, `unified-editor.spec.ts`                    |
| Unified draft editor                                  | `unified-draft-editor.tsx`                                                                                |
| Manual set creation                                   | `manual-set-creation.spec.ts`                                                                             |
| Set/card CRUD + reorder                               | `set-management.spec.ts`, `flashcard-set-ordering.spec.ts`                                                |
| Special collections                                   | `special-collections.spec.ts`                                                                             |
| Study mode                                            | `study-mode.spec.ts`                                                                                      |
| Quiz engine + history + result                        | `quiz-advancement.spec.ts`, `quiz-result-collections.spec.ts`, `supabase/tests/011_quiz_engine.sql`       |
| Quiz coverage cycle + strict pools                    | `20260812190000`, `20260812200000`, `20260813000000`, `20260813010000`, `025_strict_quiz_eligibility.sql` |
| Match                                                 | `match.spec.ts`, `022_flashcard_coverage.sql`                                                             |
| Memory                                                | `memory.spec.ts`                                                                                          |
| Mastery V1 (UI trên sets/collections)                 | `mastery-summary.spec.ts`, `mastery-visuals.spec.ts`, `tests/unit/features/mastery/`                      |
| FSRS projection + reconciliation + due read           | `fsrs-*.integration.test.ts`, `016_card_learning_schedule_table.sql`...`020_fsrs_shadow_quiz_answer.sql`  |
| Smart Review (FSRS due)                               | `smart-review.spec.ts`                                                                                    |
| New Cards                                             | `new-cards.spec.ts`, `021_new_cards.sql`                                                                  |
| Statistics + streak + calendar                        | `activity-calendar.spec.ts`, `012_learning_statistics.sql`                                                |
| Profile settings (timezone cooldown)                  | `profile-settings.spec.ts`, `011_profile_settings.sql`                                                    |

### Partially implemented

| Feature                      | Trạng thái                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Flashcard Runner             | Chưa có code; chỉ hiển thị “Sắp ra mắt” (`src/app/(app)/study/page.tsx`)                                          |
| Google Sheets private import | Hoạt động nhưng phụ thuộc OAuth browser-side + API key restricted (checklist thủ công trong `docs/DEPLOYMENT.md`) |
| FSRS → Mastery integration   | FSRS là hạ tầng; Mastery vẫn là confidence projection độc lập (đã “cutover” Smart Review dùng FSRS due)           |
| Quiz “balanced” mode         | Không còn expose cho user (UI chỉ Chưa làm/Câu sai/Ngẫu nhiên); balanced giữ vai trò internal fallback ordering   |

### Documented but not implemented (ghi trong docs/AGENTS nhưng chưa có code)

| Item                                                       | Ghi chú                                     |
| ---------------------------------------------------------- | ------------------------------------------- |
| Đổi email / mật khẩu / avatar / xóa tài khoản              | Deferred (`docs/AUTH.md`)                   |
| OCR / PDF scan / image import                              | Chủ động từ chối (scan-only PDF báo lỗi rõ) |
| Chia sẻ bộ public, marketplace, học nhóm, chat, thanh toán | Ngoài scope (AGENTS §4)                     |
| SM-2 / spaced repetition nâng cao                          | FSRS-6 đã thay thế hướng này                |
| Realtime collaboration                                     | Không có                                    |

### Implemented but poorly documented

| Item                                                                                   | Ghi chú                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `learning_coverage_sessions` + reset logic                                             | Có trong `docs/DATABASE.md` nhưng ít chi tiết về `did_reset` và advisory lock     |
| `src/features/streak/`, `analytics/`, `dashboard/` folders                             | Folder rỗng (`.gitkeep`) — không phản ánh đúng implementation nằm ở `statistics/` |
| Strict quiz eligibility (min 1 câu, không backfill)                                    | Chỉ trong migration + code; README/QUIZ.md chưa nói “Tất cả N” dưới 10 câu        |
| Production diagnostics scripts (`fsrs:compare:production`, `fsrs:diagnose:production`) | Có docs trong DATABASE.md; không có README tổng                                   |

## 7. Những thứ rõ ràng không nằm trong scope hiện tại

- AI tự sinh câu hỏi không grounded từ tài liệu (prompt Gemini luôn yêu cầu dùng source-only).
- OCR, PDF scan, ảnh.
- Chia sẻ, marketplace, social, payment.
- Realtime collaboration.
- Native mobile app.
- Achievement phức tạp / gamification ngoài streak + calendar.
- Runner game (chưa có quyết định distractor insufficient case).

## 8. Định vị lại so với AGENTS.md

`AGENTS.md` mô tả MVP 7 phase. Thực tế repo đã hoàn thành phần lớn Phase 1–6 và một phần Phase 7 (hardening, production readiness docs, E2E 114 tests). Những thay đổi lớn so với blueprint:

1. Route `/import`, `/collections`, `/history`, `/statistics`, `/settings` là **redirect** sang `/sets?create=import`, `/sets?tab=special`, `/quiz?tab=history`, `/profile?tab=statistics`, `/profile?tab=settings` (thay vì page riêng).
2. Quiz: `/quiz/[sessionId]` (không phải `/quiz/[attemptId]`); thêm `/quiz/[sessionId]/result`.
3. Thêm routes mới hoàn toàn: `/match`, `/match/session`, `/memory`, `/memory/session`, `/profile`, `/study/session`.
4. Schema thêm nhiều bảng so với AGENTS: `quiz_sessions`, `quiz_questions`, `card_review_events`, `daily_learning_records`, `card_learning_schedule`, `flashcard_coverage`, `learning_coverage_sessions`.
5. `flashcard_sets.sort_order` (custom order) + `move_flashcard_set` — AGENTS không mô tả.
6. Manual set creation đã có (AGENTS nói “Regular sets are created only through import”).
7. Tên cột env: README/`.env.example` dùng `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (không phải `NEXT_PUBLIC_SUPABASE_ANON_KEY` như AGENTS).
8. Business rule quiz: min **1** câu (không phải 10) cho “Tất cả N”; strict pools không backfill.
