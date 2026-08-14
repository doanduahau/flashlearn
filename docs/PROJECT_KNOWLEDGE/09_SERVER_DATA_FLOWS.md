# 09. Server & Data Flows

> Inventory các điểm data plumbing: server actions, RPC calls, queries, admin calls,
> external API, scripts. Với mỗi operation quan trọng: Caller, Input, Validation,
> Authorization, Operation, Tables/RPC, Return, Side effects, Errors.
> Đặc biệt chú ý mutation nào atomic / multi-step / có nguy cơ partial failure.

---

## 1. Server actions inventory

| Action                                                 | File                                                 | Input (Zod)             | RPC/DB                                                                             | Side effects                        |
| ------------------------------------------------------ | ---------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| `signUp` / `signIn` / `signOut`                        | `src/features/auth/server/actions.ts`                | `auth-schema`           | Supabase Auth                                                                      | redirect; profile trigger           |
| `importFlashcards`                                     | `src/features/imports/server/actions.ts`             | `importPayloadSchema`   | `import_flashcard_set`                                                             | `revalidatePath('/sets')`           |
| `getStudyCardCount`                                    | `src/features/study/server/actions.ts`               | `studySourceSchema`     | đọc flashcards                                                                     | —                                   |
| `startQuiz`                                            | `src/features/quiz/server/actions.ts`                | `quizStartSchema`       | `create_quiz_session`                                                              | tạo coverage session (trong RPC)    |
| `getQuizEligibility`                                   | `src/features/quiz/server/actions.ts`                | `quizEligibilitySchema` | đọc + `loadUncoveredIds` + `loadWrongAnswerCardIds`                                | —                                   |
| `submitQuizAnswer`                                     | `src/features/quiz/server/actions.ts`                | `answerSchema`          | `submit_quiz_answer` + `reconcileCardSchedule` + `completeLearningCoverageSession` | FSRS reconcile; coverage completion |
| `startSmartReview`                                     | `src/features/smart-review/server/actions.ts`        | (không input)           | đọc due + admin RPC `create_owned_quiz_session_from_card_ids`                      | —                                   |
| `getMatchAvailability` / `startMatchCoverageSession`   | `src/features/match/server/actions.ts`               | `matchStartSchema`      | đọc cards + admin RPC `create_learning_coverage_session`                           | coverage session                    |
| `getMemoryAvailability` / `startMemoryCoverageSession` | `src/features/memory/server/actions.ts`              | `memoryStartSchema`     | đọc cards + admin RPC `create_learning_coverage_session`                           | coverage session                    |
| `completeLearningCoverageSession`                      | `src/features/practice-coverage/server/actions.ts`   | uuid                    | `complete_learning_coverage_session`                                               | coverage insert + có thể reset      |
| `loadUncoveredIds` / `loadWrongAnswerCardIds`          | `src/features/practice-coverage/server/actions.ts`   | ids[]                   | đọc `flashcard_coverage` / `quiz_questions`                                        | —                                   |
| CRUD bộ/thẻ                                            | `src/features/flashcard-sets/server/actions.ts`      | `set-schema`            | bảng + RPC `add_flashcard` / `move_flashcard_set`                                  | revalidate                          |
| Collection actions                                     | `src/features/special-collections/server/actions.ts` | `collection-schema`     | RPC `create_special_collection` / `set_card_collections`                           | revalidate                          |
| Profile update                                         | `src/features/profile/server/actions.ts`             | `profile-schema`        | RPC `update_profile`                                                               | —                                   |
| Statistics load                                        | `src/features/statistics/server/load-statistics.ts`  | —                       | RPC `get_learning_statistics`                                                      | —                                   |

---

## 2. RPC call graph (mutation quan trọng)

### `create_quiz_session` — MULTI-STEP (một transaction RPC)

- **Caller:** `startQuiz` server action.
- **Input:** mode, set_ids, collection_ids, all, question_count.
- **Validation:** trong RPC — mode hợp lệ, count 1–100 (bản cuối migration
  20260813010000; UI dùng `QUIZ_MIN_QUESTIONS=10`/`QUIZ_MAX_QUESTIONS=100`), scope ≤50, all exclusivity,
  ownership từng source, đủ eligible cards, đủ distractor.
- **Authorization:** `auth.uid()` (security definer). Client không truyền user.
- **Operation (trong 1 transaction):**
  1. Advisory xact lock `user:quiz` (chống race coverage reset).
  2. Tính `scope_card_ids`.
  3. Đếm eligible (cần ≥2 back khác nhau normalized trong scope).
  4. Strict count cho never_tested (chưa cover) / wrong_answers (từng sai).
  5. INSERT quiz_sessions (requested == actual).
  6. Loop sinh quiz_questions: selection ordering (coverage → completed → last_tested
     → wrong ratio; random cho pure_random), distractor từ scope (dedupe md5), insert snapshot.
  7. Guard `v_position == p_question_count` (fail closed).
  8. Gọi `create_learning_coverage_session` (service role path trong cùng transaction).
- **Return:** session_id.
- **Errors:** `42501` auth, `22023` invalid/not enough → server action trả generic message.
- **Atomicity:** toàn bộ trong 1 RPC → rollback nếu lỗi bất kỳ đâu.

### `submit_quiz_answer` — ATOMIC (trong RPC) + 2 side-effect sau RPC (ngoài)

- **Caller:** `submitQuizAnswer` server action.
- **Input:** question_id, selected_choice_index.
- **Validation:** Zod; RPC — question thuộc user, session chưa completed, chưa trả lời
  (retry cùng đáp án idempotent, khác đáp án → not found), index < choices length.
- **Authorization:** `auth.uid()`, row lock `for update`.
- **Operation:**
  1. UPDATE quiz_questions (selected, is_correct, answered_at).
  2. INSERT card_review_events (source `quiz`, fsrs_rating 3/1) — immutable.
  3. Nếu câu cuối: UPDATE quiz_sessions (completed_at, correct_count); upsert
     `daily_learning_records` (local date theo timezone).
- **Return:** session_id, is_correct, completed, flashcard_id, review_event_id.
- **Side effects (server action, sau RPC, best-effort, không fail quiz):**
  - `reconcileCardSchedule(user, card)` — replay events → FSRS projection (admin RPC CAS).
  - Coverage completion — chỉ nếu completed + origin `manual`: đọc
    `learning_coverage_sessions` (quiz_session_id) → `completeLearningCoverageSession`.
- **Partial failure risk:** RPC luôn atomic. Side effects có thể fail riêng lẻ —
  log lỗi (`[fsrs_shadow] reconciliation failed …`) và bỏ qua; retry submit idempotent.
- **Errors:** session hết hạn → generic; RPC error → generic.

### `complete_learning_coverage_session` — ATOMIC + ADVISORY LOCK

- **Caller:** server action sau quiz/match/memory hoàn thành (hoặc client hoàn tất game).
- **Operation:** row lock session → advisory xact lock `user:mode` → insert
  flashcard_coverage (on conflict do nothing) → đếm live scope vs covered →
  nếu cover hết → delete coverage của scope (reset, `did_reset = true`) → set completed_at.
- **Idempotent:** session đã completed → trả kết quả cũ.
- **Errors:** session không thuộc user → `42501`; không tồn tại → not found.

### `upsert_card_learning_schedule` — CAS, service-role only

- **Caller:** `reconcile-card-schedule.ts` (admin client) / reconcile scripts.
- **Operation:** verify ownership → đếm schedulable events hiện tại + final event →
  freshness guard (count, event id, time) → CAS revision (insert với expected=-1 nếu chưa
  có; update nếu khớp; idempotent nếu lặp chính xác).
- **Errors:** stale → `22023`; concurrent create → retryable CAS conflict.

---

## 3. Điểm ghi dữ liệu (write paths)

| Bảng                         | Được ghi bởi                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `profiles`                   | Trigger `handle_new_user`; RPC `update_profile`                                                       |
| `flashcard_sets`             | RPC `import_flashcard_set`, RPC `move_flashcard_set`, INSERT/UPDATE trực tiếp (RLS own, giới hạn cột) |
| `flashcards`                 | RPC `import_flashcard_set`, RPC `add_flashcard`, UPDATE trực tiếp (front/back/position)               |
| `special_collections`        | RPC `create_special_collection`                                                                       |
| `special_collection_items`   | RPC `set_card_collections`                                                                            |
| `quiz_sessions`              | RPC `create_quiz_session` (insert), RPC `submit_quiz_answer` (completed_at)                           |
| `quiz_questions`             | RPC `create_quiz_session` (insert), RPC `submit_quiz_answer` (answer)                                 |
| `card_review_events`         | RPC `submit_quiz_answer` (+ tương lai: study/match/memory review)                                     |
| `card_learning_schedule`     | RPC `upsert_card_learning_schedule` (service_role)                                                    |
| `flashcard_coverage`         | RPC `complete_learning_coverage_session`                                                              |
| `learning_coverage_sessions` | RPC `create_learning_coverage_session` (service_role), RPC `complete_learning_coverage_session`       |
| `daily_learning_records`     | RPC `submit_quiz_answer` (khi hoàn thành quiz)                                                        |

**Không có client-write trực tiếp nào lên bảng quiz/events/projection/coverage.**

---

## 4. Điểm đọc dữ liệu chính

| Query                                         | File                                         | Mục đích                                                     |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `collectStudyCardIds`                         | `study/server/load-study-cards.ts`           | Dedupe scope cards (dùng cho study count + quiz eligibility) |
| `loadUncoveredIds` / `loadWrongAnswerCardIds` | `practice-coverage/server/actions.ts`        | Filter "Chưa làm"/"Câu sai" (batch 200)                      |
| `loadDueCandidateResult`                      | `spaced-repetition/server/due-repository.ts` | Due candidates (smart review, dashboard)                     |
| `loadNewCardCandidates`                       | RPC + `new-cards-repository.ts`              | New cards read model                                         |
| `get_learning_statistics`                     | RPC                                          | Statistics + streak                                          |
| `load-mastery-*`                              | `mastery/server/`                            | Mastery derived                                              |
| `load-source-page`                            | `source-selection/server/`                   | Source browser                                               |

---

## 5. External API calls

| Call                | File                                                | Key                    | Khi nào                        |
| ------------------- | --------------------------------------------------- | ---------------------- | ------------------------------ |
| Gemini generation   | `imports/adapters/gemini-provider.ts`               | `GEMINI_API_KEY`       | Paste semantic, document cards |
| Gemini classifier   | `imports/adapters/gemini-classifier.ts`             | `GEMINI_API_KEY`       | Document classification        |
| Google Picker/OAuth | `imports/server/analyze-google-sheets.ts` + browser | `NEXT_PUBLIC_GOOGLE_*` | Google Sheets import           |
| Retry policy        | `imports/adapters/gemini-retry-policy.ts`           | —                      | Bọc Gemini calls               |

---

## 6. Background / reconciliation scripts

| Script                                               | Mục đích                                  | An toàn                                                                                        |
| ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `scripts/fsrs-reconcile-local.ts` / `-production.ts` | Reconcile toàn bộ projection từ events    | Production runner cần allowlist `FLASHLEARN_PRODUCTION_PROJECT_REF`; fail closed nếu thiếu env |
| `scripts/fsrs-compare-local.ts` / `-production.ts`   | So sánh projection vs replay (diagnostic) | Read-only                                                                                      |
| `scripts/fsrs-diagnose-production.ts`                | Diagnose                                  | Read-only, production guard                                                                    |
| `scripts/test-production-pdf-*.mjs`                  | Verify PDF isolation production           | Read-only test                                                                                 |

---

## 7. Data flow tổng quát

```
UI (Client Component)
   │  server action call (useActionState / form action)
   ▼
Server Action ("use server")
   │  Zod validate input
   │  auth check (getClaims)
   ▼
Domain/service layer (nếu có — hầu hết inline trong actions)
   │
   ▼
Supabase: createClient() (cookie session) hoặc createAdminClient() (service role)
   │
   ▼
RPC (security definer / service-role) hoặc query (RLS)
   │
   ▼
PostgreSQL: bảng + trigger + constraints
   │
   ▼
Return value → server action → UI state / redirect / revalidatePath
```

Điểm cần lưu ý: không có service layer riêng tách rời actions — business logic nằm
trong server actions + RPC SQL. RPC giữ phần lớn invariant nghiệp vụ quan trọng
(quiz creation, submit, coverage, projection CAS).
