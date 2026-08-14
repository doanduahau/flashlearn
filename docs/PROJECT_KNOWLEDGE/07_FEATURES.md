# 07. Features

> Phân tích từng feature thực sự tồn tại trong `src/features/`. Đây là file chi tiết
> nhất về functionality. Mỗi feature gồm: Purpose, User-facing behavior, Routes,
> Components, Server logic, Validation, Database, State, Algorithms, Dependencies,
> Tests, Constraints, Source files.

---

## 1. Auth

- **Purpose:** Đăng nhập, đăng ký, đăng xuất, quản lý session.
- **User-facing behavior:** Sign up (email + password + display name), sign in,
  sign out; redirect an toàn theo `next`; check-email khi confirm bật.
- **Routes:** `/sign-in`, `/sign-up`, `/check-email`, `/auth/confirm`, `/auth/error`;
  guard ở `(app)/layout.tsx` (server redirect) + `src/proxy.ts` (cookie refresh).
- **Components:** `sign-in-form.tsx`, `sign-up-error-display.tsx`, `current-user.tsx`,
  `sign-out-button.tsx`.
- **Server logic:** `src/features/auth/server/actions.ts` (`signUp`, `signIn`, `signOut`).
- **Validation:** `schemas/auth-schema.ts` (Zod) — email, password, display name.
- **Database:** `auth.users` (Supabase managed), `profiles` (trigger `handle_new_user`).
- **State:** Session trong cookie (`@supabase/ssr`).
- **Algorithms:** safe redirect (`utils/safe-redirect.ts`), auth error map
  (`utils/auth-error.ts`), route sau auth (`utils/routes.ts`).
- **Dependencies:** `lib/supabase/server.ts`, `lib/env.ts`.
- **Tests:** `tests/unit/features/auth/`, `tests/e2e/auth.spec.ts`, `auth-no-confirm.spec.ts`.
- **Constraints:** Email confirm bật; profile tạo tự động; không cho client set user_id.
- **Source files:** toàn bộ `src/features/auth/`, `src/proxy.ts`, `(app)/layout.tsx`.

---

## 2. Import (Excel / CSV / Paste / Google Sheets / PDF / DOCX)

- **Purpose:** Biến file/nội dung thành bộ flashcard.
- **User-facing behavior:** Wizard gồm: chọn nguồn (file Excel/CSV, paste text,
  Google Sheets, PDF/DOCX) → parse → chọn sheet/cột → normalize → preview + validate
  → xác nhận → tạo bộ. Paste có thể dùng Gemini để sinh thẻ từ văn bản liên tục;
  document (PDF/DOCX) có classifier + section builder + Gemini generation.
- **Routes:** `/import`.
- **Components:** `components/import-wizard.tsx`, `components/unified-draft-editor.tsx`
  (editor thẻ trước khi lưu).
- **Server logic:**
  - `server/actions.ts`: `importFlashcards` → RPC `import_flashcard_set`.
  - `server/analyze-document.ts`, `server/extract-document.ts`,
    `server/generate-document-cards.ts`: luồng document import (PDF/DOCX → sections → cards).
  - `server/analyze-paste.ts`: phân tích paste (có cấu trúc hoặc qua Gemini).
  - `server/analyze-google-sheets.ts`: Google Sheets qua Picker.
- **Adapters:** `adapters/excel-adapter.ts`, `pdf-adapter.ts`, `docx-adapter.ts`
  (mammoth), `paste-adapter.ts`, `google-sheets-adapter.ts`, `gemini-provider.ts`,
  `gemini-classifier.ts`, `gemini-retry-policy.ts`.
- **Validation:** `schemas/import-schema.ts` (Zod payload cuối: name + cards array);
  `utils/validate-draft-cards.ts` (draft-level); `utils/normalize-import-row.ts`
  (trim, newline normalize); `utils/detect-columns.ts` (auto map cột).
- **Database:** RPC `import_flashcard_set(name, cards jsonb)` — atomic transaction,
  gán position theo thứ tự (bản cuối migration 20260807110000).
- **State:** Wizard state trong client component; payload cuối gửi qua server action.
- **Algorithms:** workbook parsing (xlsx), paste parsing (TSV, Q:/A:, separator detection),
  document classifier (xác định loại tài liệu), section builder (nhóm đoạn văn),
  Gemini semantic generation.
- **Dependencies:** `lib/supabase/server.ts`, Gemini API, Google Picker.
- **Tests:** `tests/unit/features/imports/` (parse, normalize, classify, columns),
  E2E: `paste-import.spec.ts`, `document-import.spec.ts`, `document-auto-detection.spec.ts`,
  `unified-editor.spec.ts`, `pdf-runtime-isolation.spec.ts`.
- **Constraints:**
  - Giới hạn dung lượng/số hàng (`src/lib/constants.ts`).
  - Không lưu file gốc; không thực thi macro/formula.
  - Server re-validate payload (không tin client parse).
  - Trùng chính xác sau trim bị đánh dấu/bỏ và thông báo.
- **Source files:** toàn bộ `src/features/imports/`.

---

## 3. Flashcard Sets (bộ thường + CRUD thẻ)

- **Purpose:** Quản lý bộ thông thường và thẻ.
- **User-facing behavior:** Danh sách bộ, tạo bộ thủ công (form nhập tên + thẻ),
  xem chi tiết bộ + danh sách thẻ, sửa/xóa thẻ, sửa/xóa bộ, reorder bộ (drag & drop).
- **Routes:** `/sets`, `/sets/[setId]`.
- **Components:** `manual-set-form.tsx`, `set-reorder-list.tsx` (dnd-kit).
- **Server logic:** `server/actions.ts` — tạo/sửa/xóa bộ, `addFlashcard` (RPC `add_flashcard`),
  sửa/xóa thẻ (bảng trực tiếp với giới hạn cột), `moveFlashcardSet` (RPC).
- **Validation:** `schemas/set-schema.ts`.
- **Database:** `flashcard_sets`, `flashcards`, RPC `add_flashcard`, `move_flashcard_set`,
  `import_flashcard_set`.
- **State:** Server (bảng) + query string cho pagination.
- **Algorithms:** `utils/search.ts` (tìm kiếm bộ), position management.
- **Dependencies:** `lib/supabase/server.ts`, `lib/normalize-content.ts`.
- **Tests:** `tests/unit/features/flashcard-sets/`, E2E `set-management.spec.ts`,
  `manual-set-creation.spec.ts`, `flashcard-set-ordering.spec.ts`.
- **Constraints:** Update chỉ front/back/position (không đổi set_id/user_id từ client);
  name bộ không rỗng, ≤120; content trim ≤50000.
- **Source files:** `src/features/flashcard-sets/`.

---

## 4. Special Collections (bộ đặc biệt)

- **Purpose:** Gom thẻ từ nhiều bộ vào collection cá nhân (Khó nhớ, Yêu thích…).
- **User-facing behavior:** Tạo collection (name + icon + color), xem danh sách,
  xem chi tiết (danh sách thẻ), gắn/gỡ thẻ từ trang thẻ hoặc sau quiz result.
- **Routes:** `/collections`, `/collections/[collectionId]`.
- **Components:** `card-collections-control.tsx`.
- **Server logic:** `server/actions.ts` — tạo collection (RPC `create_special_collection`),
  `setCardCollections` (RPC `set_card_collections`).
- **Validation:** `schemas/collection-schema.ts` (name ≤60, icon/color ≤32).
- **Database:** `special_collections` (unique tên CI per user), `special_collection_items`
  (PK collection+card, composite FK ownership).
- **State:** Server bảng + RPC.
- **Algorithms:** Membership replace (set semantics qua RPC).
- **Dependencies:** `lib/supabase/server.ts`.
- **Tests:** `tests/unit/features/special-collections/`, E2E `special-collections.spec.ts`,
  `quiz-result-collections.spec.ts`.
- **Constraints:** Một thẻ thuộc nhiều collection; collection xóa không xóa thẻ;
  cross-user membership bị chặn ở DB.
- **Source files:** `src/features/special-collections/`.

---

## 5. Study (chế độ học flashcard)

- **Purpose:** Học thẻ bằng cách lật front/back.
- **User-facing behavior:** Chọn nguồn (set/collection), chọn chế độ, lật thẻ,
  thẻ trước/sau, trộn.
- **Routes:** `/study`, `/study/session`.
- **Components:** `study-source-select.tsx`, `study-session.tsx`.
- **Server logic:** `server/actions.ts` (`getStudyCardCount`), `server/load-study-cards.ts`
  (`collectStudyCardIds` — dùng chung bởi quiz eligibility), `server/load-study-session.ts`.
- **Validation:** `schemas/study-schema.ts`.
- **Database:** đọc `flashcards`, `flashcard_sets`, `special_collection_items`.
- **State:** Client session (danh sách thẻ + index + flipped), shuffle seed.
- **Algorithms:** `utils/shuffle.ts` (deterministic/seed shuffle), `utils/merge-cards.ts`
  (gộp + dedupe theo flashcard_id).
- **Dependencies:** `flashcard-sets`, `special-collections`.
- **Tests:** `tests/unit/features/study/`, E2E `study-mode.spec.ts`.
- **Constraints:** Dedupe theo id; shuffle không trùng.
- **Source files:** `src/features/study/`.

---

## 6. Quiz (engine + session + result)

- **Purpose:** Tạo bài test từ nguồn đã chọn với 4 mode; chấm điểm; kết quả.
- **User-facing behavior:** Setup (chọn nguồn: tất cả/set/collection + filter
  Chưa làm/Câu sai/Ngẫu nhiên + số câu 10–50/100) → làm bài (1 câu/lần, 4 đáp án)
  → kết quả (đúng/sai, thêm thẻ vào collection).
- **Routes:** `/quiz`, `/quiz/[sessionId]`, `/quiz/[sessionId]/result`.
- **Components:** `quiz-setup.tsx`, `quiz-session.tsx`.
- **Server logic:** `server/actions.ts`:
  - `startQuiz` → RPC `create_quiz_session` (strict).
  - `getQuizEligibility` → `collectStudyCardIds` + `loadUncoveredIds` + `loadWrongAnswerCardIds`.
  - `submitQuizAnswer` → RPC `submit_quiz_answer`; sau đó shadow FSRS reconcile
    (best-effort, không fail quiz) + coverage completion (chỉ origin `manual`).
- **Validation:** `schemas/quiz-schema.ts` — `quizStartSchema`, `answerSchema`,
  `quizEligibilitySchema`, `QuizMode = 'balanced' | 'never_tested' | 'wrong_answers' | 'pure_random'`.
- **Database:** `quiz_sessions`, `quiz_questions`, `card_review_events` (ghi),
  `daily_learning_records` (ghi khi hoàn thành), coverage.
- **State:** Server (bảng) + client (câu hiện tại).
- **Algorithms:**
  - Strict pool: `never_tested` chỉ thẻ chưa cover; `wrong_answers` chỉ thẻ từng sai;
    không backfill (migration 20260813000000).
  - Selection ordering: ưu tiên chưa cover → ít completed → lâu chưa test → tỷ lệ sai
    cao; `pure_random` dùng `random()` + md5 tiebreak; deterministic md5 order cho còn lại.
  - Distractor: 3 đáp án từ scope, dedupe theo normalized back (lower/trim/collapse space),
    trộn bằng md5 ordering; cần ≥2 back khác nhau.
  - Submit: row lock; idempotent retry; ghi event + fsrs_rating (correct→Good(3),
    wrong→Again(1)); hoàn tất → daily record.
- **Dependencies:** `study` (collectStudyCardIds), `practice-coverage`,
  `spaced-repetition` (reconcile), `learning-modes`, `special-collections`.
- **Tests:** `tests/unit/features/quiz/`, integration `fsrs-shadow-quiz.integration.test.ts`,
  `card-scope-mismatch.integration.test.ts`, E2E `quiz-advancement.spec.ts`,
  `quiz-result-collections.spec.ts`, `learning-mode-setup.spec.ts`.
- **Constraints:**
  - `requested_question_count == actual_question_count`; fail closed khi pool thiếu.
  - Min 10 câu, max = pool hợp lệ (UI hiển thị "Tất cả N").
  - Advisory lock `user:quiz` chống race coverage-reset giữa count và select.
  - Snapshot câu hỏi bất biến khi sửa thẻ.
- **Source files:** `src/features/quiz/`.

---

## 7. Smart Review

- **Purpose:** Phiên ôn thẻ đến hạn theo FSRS due.
- **User-facing behavior:** Nút "Ôn thẻ" trên dashboard → tạo phiên quiz từ thẻ due
  (batch 10), làm bài như quiz thường.
- **Routes:** (dashboard CTA) + session quiz chung `/quiz/[sessionId]`.
- **Components:** `start-smart-review-button.tsx`, `smart-review-continuation.tsx`.
- **Server logic:** `server/actions.ts` — `startSmartReview`: không nhận client input;
  load due candidates (`loadDueCandidateResult`, scope library, batch 10) → RPC
  `create_owned_quiz_session_from_card_ids` qua **admin client** (set origin `smart_review`).
- **Validation:** không có input client; fail closed khi chưa đăng nhập hoặc không còn thẻ.
- **Database:** `card_learning_schedule` (due read), RPC service-role
  `create_owned_quiz_session_from_card_ids`.
- **State:** Session quiz như thường (origin `smart_review`).
- **Algorithms:** due candidates ordered by due, last_review, id.
- **Dependencies:** `spaced-repetition`, `quiz`, `lib/supabase/admin.ts`.
- **Tests:** `tests/unit/features/smart-review/`, E2E `smart-review.spec.ts`.
- **Constraints:** Smart Review session **không** tạo coverage quiz session
  (chỉ origin `manual`); nếu hết thẻ → trả `{ empty: true }` để UI báo "Không còn thẻ cần ôn".
- **Source files:** `src/features/smart-review/`.

---

## 8. Spaced Repetition (FSRS-6)

- **Purpose:** Lịch trình ôn tập dựa trên FSRS-6 (ts-fsrs 5.4.1) — hiện là **infrastructure
  thuần** (ghi schedule, đọc due, dashboard counts); **chưa** ảnh hưởng Smart Review
  eligibility theo config comment (xem `config.ts` STATUS), nhưng Smart Review đọc due
  từ schedule (xem mục 7).
- **User-facing behavior:** Dashboard hiển thị "Cần ôn" (due count) và "Chưa học"
  (new cards count); nút bắt đầu New Cards / Smart Review.
- **Routes:** dashboard; session chung.
- **Components:** `start-new-cards-button.tsx`, `new-cards-continuation.tsx`.
- **Server logic:**
  - `server/reconcile-card-schedule.ts` + `server/reconcile-orchestrator.ts`: replay
    events → FSRS state → `upsert_card_learning_schedule` (CAS).
  - `server/due-repository.ts`: `countDueCards`, `findDueCandidates`, `loadDueCandidateResult`.
  - `server/new-cards-repository.ts` + RPC `load_new_card_candidates`.
  - `server/actions.ts`: dashboard counts.
  - `server/service-role-repository.ts`, `server/schedule-repository.ts`.
- **Config:** `config.ts` — frozen `flashlearn-v1`: weights W (21 số), retention 0.9,
  max interval 36500, no fuzz, short-term on, steps 1m/10m, relearning 10m.
- **Validation:** projection CAS + freshness guard trong RPC; events bất biến.
- **Database:** `card_review_events`, `card_learning_schedule`, RPC `upsert_card_learning_schedule`,
  `load_new_card_candidates`.
- **State:** DB projection (rebuildable).
- **Algorithms:** FSRS-6 scheduling; rating map `incorrect→Again, correct→Good`;
  replay strategy (`utils/decide-replay-strategy.ts`); retrievability
  (`utils/retrievability.ts`); due candidates (`utils/due-candidates.ts`).
- **Dependencies:** `ts-fsrs`, `lib/supabase/admin.ts`, `lib/supabase/server.ts`.
- **Tests:** `tests/unit/features/spaced-repetition/`, integration `fsrs-*.integration.test.ts`
  (due read, shadow quiz, reconciliation, direct-due cutover), scripts `scripts/fsrs-*.ts`.
- **Constraints:**
  - `flashlearn-v1` bất biến — đổi tham số phải đổi `parameter_set`.
  - Projection luôn khớp events (CAS); không ghi trực tiếp.
  - Số event processed ≥1; schedule không tồn tại cho thẻ chưa có review schedulable.
- **Source files:** `src/features/spaced-repetition/`.

---

## 9. Mastery

- **Purpose:** Tính "thành thạo" của thẻ từ lịch sử review; tổng hợp cho UI.
- **User-facing behavior:** Dashboard/hiển thị summary mastery (chưa rõ ở đâu hiển thị
  chi tiết — xem E2E `mastery-summary.spec.ts`, `mastery-visuals.spec.ts`).
- **Routes:** dashboard + các trang liên quan.
- **Components:** presentation helpers (`presentation/mastery-presentation.ts`).
- **Server logic:** `server/load-card-masteries.ts`, `server/load-mastery-snapshot.ts`,
  `server/load-mastery-aggregate.ts`.
- **Validation:** n/a (đọc từ DB).
- **Database:** đọc `card_review_events`, `flashcards`.
- **State:** Derived — không lưu mastery; tính từ events.
- **Algorithms:** `utils/derive-flashcard-mastery.ts` (per-card từ events),
  `utils/aggregate-mastery.ts`, `utils/find-active-card-ids.ts`,
  `utils/select-smart-review-candidates.ts`.
- **Dependencies:** `spaced-repetition` types.
- **Tests:** `tests/unit/features/mastery/`, integration
  `mastery-snapshot-completeness.integration.test.ts`, E2E `mastery-summary.spec.ts`,
  `mastery-visuals.spec.ts`.
- **Constraints:** Mastery là derived read model; không lưu trạng thái riêng.
- **Source files:** `src/features/mastery/`.

---

## 10. Practice Coverage

- **Purpose:** Theo dõi thẻ đã "làm" trong cycle hiện tại theo mode (quiz/match/memory/runner);
  nguồn cho filter "Chưa làm" và "Câu sai".
- **User-facing behavior:** Filter Chưa làm/Câu sai ở quiz, match, memory dùng chung
  dữ liệu này.
- **Routes:** n/a (server helper).
- **Components:** n/a.
- **Server logic:** `server/actions.ts` — `loadUncoveredIds(mode, ids)`,
  `loadWrongAnswerCardIds(ids)` (canonical wrong history từ quiz completed),
  `completeLearningCoverageSession(sessionId)`.
- **Validation:** session id phải là uuid.
- **Database:** `flashcard_coverage`, `learning_coverage_sessions`, `quiz_questions`
  (wrong history), RPC `complete_learning_coverage_session`.
- **State:** DB (coverage ledger + session snapshots).
- **Algorithms:** chunking (batch 200) cho query lớn; completion idempotent;
  reset khi scope cover hết (advisory lock `user:mode`).
- **Dependencies:** `lib/supabase/server.ts`.
- **Tests:** `tests/unit/features/practice-coverage/`, integration
  `card-scope-mismatch.integration.test.ts`.
- **Constraints:** Client không ghi coverage trực tiếp; completion qua opaque session id;
  smart review/new cards không tạo quiz coverage.
- **Source files:** `src/features/practice-coverage/`.

---

## 11. Learning Modes (shared filter + số câu)

- **Purpose:** Thống nhất UI và logic cho 3 filter (`unseen`/`wrong`/`random`) và
  chọn số câu cho quiz/match/memory.
- **User-facing behavior:** Bộ chọn filter + số câu + sticky start bar.
- **Routes:** `/quiz`, `/match`, `/memory` setup.
- **Components:** `mode-filter.tsx`, `question-count-selector.tsx`, `sticky-start-bar.tsx`.
- **Server logic:** n/a (types.ts là logic thuần).
- **Validation:** `types.ts` helpers.
- **Database:** n/a.
- **State:** Client.
- **Algorithms:** `learningFilterToQuizMode` (unseen→never_tested, wrong→wrong_answers,
  random→pure_random); `applyLearningFilter` (strict pool — unseen giữ chưa cover,
  wrong giữ từng sai, random giữ toàn pool); message helpers.
- **Dependencies:** `quiz` (QuizMode type).
- **Tests:** `tests/unit/features/learning-modes/`, E2E `learning-mode-setup.spec.ts`.
- **Constraints:** Filter không backfill; "Cân bằng" không còn exposed trong UI
  (quiz engine vẫn giữ internal balanced ordering).
- **Source files:** `src/features/learning-modes/`.

---

## 12. Match

- **Purpose:** Trò chơi ghép cặp front/back.
- **User-facing behavior:** Setup (nguồn + filter + số câu) → board ghép cặp →
  hoàn tất (coverage).
- **Routes:** `/match`, `/match/session`.
- **Components:** `match-setup.tsx`, `match-session.tsx`, `match-board.tsx`.
- **Server logic:** `server/actions.ts` — `getMatchAvailability`, `startMatchCoverageSession`
  (load cards → filter → build session → RPC `create_learning_coverage_session` qua admin).
- **Validation:** `schemas/match-schema.ts`.
- **Database:** đọc `flashcards` (+ collections); coverage mode `match`.
- **State:** Client session (seeded random từ `node:crypto` randomInt).
- **Algorithms:** `utils/match-session.ts` (buildMatchSession, createSeededMatchRandom,
  getMatchEligibility), `utils/match-state.ts` (state máy), `utils/match-normalize.ts`.
- **Dependencies:** `learning-modes`, `practice-coverage`, `lib/supabase/admin.ts`.
- **Tests:** `tests/unit/features/match/`, E2E `match.spec.ts`.
- **Constraints:** Số câu phải nằm trong availableCounts (không âm thầm giảm);
  coverage chỉ commit khi hoàn tất.
- **Source files:** `src/features/match/`.

---

## 13. Memory

- **Purpose:** Trò chơi Memory (lật ô nhớ vị trí cặp front/back).
- **User-facing behavior:** Setup → grid ô → lật tìm cặp → hoàn tất (coverage).
- **Routes:** `/memory`, `/memory/session`.
- **Components:** `memory-session.tsx`.
- **Server logic:** `server/actions.ts` — `getMemoryAvailability`, `startMemoryCoverageSession`
  (giống pattern match, mode `memory`).
- **Validation:** `schemas/memory-schema.ts`.
- **Database:** đọc `flashcards`; coverage mode `memory`.
- **State:** Client session; grid layout từ `utils/memory-grid-layout.ts`.
- **Algorithms:** `utils/memory-session.ts` (build batches/eligibility),
  `utils/memory-state.ts`.
- **Dependencies:** `learning-modes`, `practice-coverage`, `lib/supabase/admin.ts`.
- **Tests:** `tests/unit/features/memory/`, E2E `memory.spec.ts`.
- **Constraints:** Như match (số câu strict, coverage khi hoàn tất).
- **Source files:** `src/features/memory/`.

---

## 14. Statistics (thống kê + streak)

- **Purpose:** Streak, thống kê quiz, activity calendar.
- **User-facing behavior:** Trang thống kê: streak hiện tại/dài nhất, tổng quiz,
  câu đã trả lời, độ chính xác, mode breakdown, 30 ngày activity, recent quizzes;
  dashboard hiển thị streak.
- **Routes:** `/statistics`, dashboard.
- **Components:** `statistics-panel.tsx`, `activity-calendar-grid.tsx`,
  `month-activity-calendar.tsx`, `streak-indicator.tsx`.
- **Server logic:** `server/load-statistics.ts` → RPC `get_learning_statistics`.
- **Validation:** n/a.
- **Database:** RPC `get_learning_statistics` (đọc quiz_sessions + profiles timezone),
  `daily_learning_records` (read).
- **State:** Server RPC trả jsonb.
- **Algorithms:** streak từ completed quiz sessions theo local date (timezone profile,
  fallback Asia/Ho_Chi_Minh); longest streak; 30-day activity; `utils/streak.ts`
  (pure function tính streak từ records — dùng cho daily records path),
  `utils/month-activity.ts`, `utils/streak-label.ts`.
- **Dependencies:** `lib/supabase/server.ts`.
- **Tests:** `tests/unit/features/statistics/`, E2E `activity-calendar.spec.ts`.
- **Constraints:** Streak theo local date; 1 quiz/ngày đủ duy trì; nhiều quiz cùng
  ngày = 1 ngày streak.
- **Source files:** `src/features/statistics/`.

---

## 15. Profile

- **Purpose:** Hồ sơ + timezone.
- **User-facing behavior:** Form sửa display name + timezone.
- **Routes:** `/profile`, `/settings`.
- **Components:** `profile-settings-form.tsx`.
- **Server logic:** `server/actions.ts` (RPC `update_profile`), `server/load-profile.ts`.
- **Validation:** `schemas/profile-schema.ts` — timezone phải có trong
  `constants/timezones.ts`.
- **Database:** `profiles`, RPC `update_profile` (bảo vệ activity date khi đổi timezone).
- **State:** Server.
- **Dependencies:** `lib/supabase/server.ts`.
- **Tests:** `tests/unit/features/profile/`, E2E `profile-settings.spec.ts`.
- **Constraints:** Không đổi timezone làm mất/mốc ngày activity (migration 20260806140000).
- **Source files:** `src/features/profile/`.

---

## 16. Dashboard

- **Purpose:** Tổng quan: chào, CTA ôn bài, streak, due/new counts, thẻ cần ôn.
- **User-facing behavior:** Dashboard learning status (Cần ôn / Chưa học),
  streak indicator, CTA.
- **Routes:** `/dashboard`.
- **Components:** `dashboard-learning-status.tsx`.
- **Server logic:** page server component đọc due count + new card candidates +
  statistics.
- **Database:** `card_learning_schedule`, `load_new_card_candidates`, statistics RPC.
- **State:** Server.
- **Dependencies:** `spaced-repetition`, `statistics`, `mastery`.
- **Tests:** `tests/unit/features/dashboard/`, E2E `primary-navigation.spec.ts` (nav).
- **Source files:** `src/features/dashboard/`.

---

## 17. Source Selection

- **Purpose:** Chọn nguồn (tất cả / set / collection) cho quiz & learning modes.
- **User-facing behavior:** Browser nguồn với search + phân trang.
- **Routes:** setup quiz/match/memory/study.
- **Components:** `source-browser.tsx`.
- **Server logic:** `server/load-source-page.ts` (danh sách nguồn theo page/search).
- **Types:** `types/source-types.ts`.
- **Database:** đọc `flashcard_sets`, `special_collections`.
- **State:** Server + query string.
- **Dependencies:** `flashcard-sets`, `special-collections`.
- **Tests:** `tests/unit/features/source-selection/`, E2E `source-selection-scale.spec.ts`.
- **Source files:** `src/features/source-selection/`.

---

## 18. Feature trống (chỉ `.gitkeep`)

`src/features/flashcards/`, `src/features/streak/`, `src/features/analytics/` — thư mục
trống từ blueprint AGENTS.md. Chức năng tương ứng nằm ở feature khác
(xem [04_CODEBASE_MAP.md §1](./04_CODEBASE_MAP.md)).
