# CapyStudy — Task 4b: sửa ưu tiên thẻ Match + Quiz (theo đúng quyết định chốt)

> **Status:** ready (2026-08-15)
> **Baseline commit:** `9429e3b` (đã push, main synced)
> **Agent tier:** Codex + GPT-5.6 Terra (chính); **Sol review bắt buộc** (chạm quiz RPC + migration mới)
> **Decisions locked (user, 2026-08-15):**
>
> 1. **Match phải dùng ưu tiên sai → chưa làm → ngẫu nhiên** (giống Memory/Runner) — KHÔNG hardcode `filter=random`. Không cần migration.
> 2. **Cho phép 1 migration nhỏ** để Quiz trộn đúng thứ tự ưu tiên sai → chưa làm → ngẫu nhiên (RPC hiện tại chỉ nhận 1 mode nên không trộn được — đã được user duyệt migration).
> 3. **Sửa E2E cũ** (`primary-navigation.spec.ts`) cho khớp hành vi mới.
>
> **Ngoài phạm vi:** /sets, /study (Task 3 đã verified đúng), thoát/pause (Task 5), mascot level (Task 7).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước (bắt buộc):

- `src/features/learning-modes/types.ts` — `selectCardsByPriority(ids, wrongIds, uncoveredIds, count)` (helper dùng chung, ĐÃ CÓ)
- `src/features/runner/server/actions.ts` (khoảng dòng 160–200) — **mẫu chuẩn**: shuffle pool → `selectCardsByPriority` → dùng kết quả làm session card ids
- `src/features/match/server/actions.ts` — `getMatchAvailability`, `startMatchCoverageSession`, `filterCardsByMode`, `loadCards`
- `src/features/match/schemas/match-schema.ts` — `matchStartSchema` có `filter` field
- `src/features/match/components/match-setup.tsx` — hiện truyền `filter: "random"` hardcode
- `src/features/quiz/components/quiz-mode-select.tsx` — `buildMatchQuery` đặt `filter=random`; `autoQuizMode` (chọn 1 mode) → **cần thay bằng trộn thật**
- `src/app/(app)/match/session/page.tsx` + `src/features/match/components/match-session.tsx` — đọc `filter` từ URL → truyền xuống
- `src/features/quiz/server/actions.ts` — `startQuiz` (gọi RPC `create_quiz_session`), `getQuizEligibility`
- `supabase/migrations/20260810120000_add_explicit_quiz_card_sessions.sql` — **mẫu RPC `create_quiz_session_from_card_ids`** (giới hạn 1–10 thẻ, dùng cho Smart Review) — tham khảo cách nhận `p_card_ids` + distractor
- `supabase/migrations/20260813010000_harden_strict_quiz_session_creation.sql` — `create_quiz_session` hiện tại (mode + source + count, tự chọn câu + distractor)
- `supabase/migrations/20260814020000_define_wrong_quiz_cards_by_latest_answer.sql` — định nghĩa "câu sai" (lần trả lời gần nhất sai)
- `tests/e2e/primary-navigation.spec.ts` — 2 assertion cũ cần sửa

---

## 1. Commit 1 — Match dùng ưu tiên sai → chưa làm → ngẫu nhiên (không migration)

Mục tiêu: bỏ hoàn toàn `filter` khỏi luồng Match; `startMatchCoverageSession` tự chọn theo `selectCardsByPriority` giống Runner.

### 1.1 `src/features/match/server/actions.ts`

- `getMatchAvailability`: bỏ `filterCardsByMode(cards, parsed.data.filter)` → eligibleCount = số thẻ hợp lệ trong pool (không còn strict pool theo filter). `filterByEligibility`/`getMatchEligibility` giữ nguyên.
- `startMatchCoverageSession`:
  1. `loadCards` → pool hợp lệ (như hiện tại).
  2. Shuffle pool bằng `createSeededMatchRandom` (đã có) — để phần "ngẫu nhiên" thật sự ngẫu nhiên.
  3. `Promise.all([loadUncoveredIds("match", poolIds), loadWrongAnswerCardIds(poolIds)])`.
  4. `selectCardsByPriority(poolIds, wrong, uncoveredSet, questionCount)` → danh sách `selectedIds` theo đúng thứ tự **sai → chưa làm → ngẫu nhiên**.
  5. `buildMatchSession(selectedCards, questionCount, rng)` — selectedCards = cards khớp selectedIds.
  6. `create_learning_coverage_session` với `p_session_card_ids = selectedIds`, `p_scope_card_ids = poolIds` (giữ nguyên).
- Xóa `filterCardsByMode` nếu không còn ai dùng (grep trước khi xóa).
- `matchStartSchema` (`match-schema.ts`): **bỏ field `filter`** (hoặc giữ optional + đánh dấu deprecated — chọn cách sạch nhất; nếu giữ, không được dùng trong logic).

### 1.2 UI/caller

- `src/features/quiz/components/quiz-mode-select.tsx`: `buildMatchQuery` — **bỏ `q.set("filter", "random")`**.
- `src/features/match/components/match-setup.tsx`: bỏ `filter: "random"` khỏi cả 2 chỗ gọi `getMatchAvailability` + `startMatchCoverageSession` (và khỏi deps array nếu có).
- `src/app/(app)/match/session/page.tsx`: bỏ `parseFilter` + `filter` khỏi `buildQuery`/`sessionHref`/props truyền xuống.
- `src/features/match/components/match-session.tsx`: `sourceFromHref` — bỏ đọc `filter` từ URL.
- Kiểm tra `startMatchCoverageSession` caller khác (grep toàn repo).

### 1.3 Test

- Cập nhật unit test match (nếu có test assert filter pool).
- Thêm/giữ test: `selectCardsByPriority` đã có test ở Task 3 — nếu chưa đủ case cho Match thì bổ sung.

Commit message:

```bash
git commit -m "fix: apply wrong-first priority to match sessions"
```

---

## 2. Commit 2 — Quiz trộn đúng thứ tự ưu tiên (migration mới)

Vấn đề hiện tại: `autoQuizMode` chọn 1 mode duy nhất → khi có 3 câu sai + 30 chưa làm, cần 10 câu → chọn `never_tested` → **bỏ 3 câu sai** (sai). Đáng lẽ: 3 sai + 7 chưa làm.

### 2.1 Migration mới (được user duyệt)

Tạo `supabase/migrations/20260815XXXXXX_quiz_session_with_prioritized_cards.sql` (dùng timestamp mới nhất):

- Tạo RPC mới `create_quiz_session_prioritized` (SECURITY DEFINER, hardened empty search_path, service-role only — theo pattern `create_quiz_session` + `create_quiz_session_from_card_ids`):
  - Nhận: `p_user_id uuid`, `p_card_ids uuid[]` (thứ tự đã ưu tiên sẵn từ server), `p_scope_card_ids uuid[]` (để sinh distractor), `p_question_count integer`.
  - Validate: `p_card_ids` không null/không trùng/non-empty, ≤ 100, tất cả thuộc user (`user_id = p_user_id`), `p_question_count = cardinality(p_card_ids)` (hoặc ≤ — theo contract chọn 1, ghi rõ trong evidence).
  - Tạo `quiz_sessions` (origin `manual`) + `quiz_questions` theo đúng thứ tự `p_card_ids` (mỗi card → 1 câu hỏi), distractor lấy từ `p_scope_card_ids` (các thẻ khác của user, loại trùng nội dung) — **giữ nguyên thuật toán distractor hiện có của `create_quiz_session`**, tách phần sinh câu hỏi thành hàm dùng chung nếu cần (không refactor quá mức).
  - Trigger/constraint coverage `mode = quiz` giữ nguyên (tham khảo migration runner/memory coverage tạo session — `20260813020000` dòng 65–127 có pattern buộc mode).
  - Grant chỉ service_role; revoke public/anon/authenticated (theo pattern hiện có).
- **KHÔNG sửa migration cũ** — chỉ thêm mới.

### 2.2 Server action

- `src/features/quiz/server/actions.ts` — `startQuiz` đổi thành:
  1. `collectStudyCardIds` → pool.
  2. `loadWrongAnswerCardIds(poolIds)` + `loadUncoveredIds("quiz", poolIds)`.
  3. Shuffle pool (seeded/deterministic theo pattern Runner) → `selectCardsByPriority(poolIds, wrong, uncoveredSet, questionCount)` → `selectedIds` (đúng thứ tự sai → chưa làm → ngẫu nhiên).
  4. Gọi RPC mới `create_quiz_session_prioritized` qua `createAdminClient()` với `p_card_ids = selectedIds` + `p_scope_card_ids = poolIds`.
  5. Return sessionId.
- Giữ `getQuizEligibility` như hiện tại (UI dùng để hiển thị số thẻ + disable).
- `quiz-mode-select.tsx`: **xóa `autoQuizMode`** — `startQuiz` không còn nhận `mode` (hoặc giữ param nhưng bỏ dùng — chọn cách sạch nhất, cập nhật schema nếu cần).

### 2.3 Test

- pgTAP mới (hoặc bổ sung vào test file quiz hiện có, tham khảo `supabase/tests/025_strict_quiz_eligibility.sql`): RPC mới chọn đúng thẻ theo thứ tự truyền vào, distractor không trùng, ownership, reject khi card không thuộc user, atomic rollback.
- Unit: `startQuiz` gọi RPC mới với đúng selectedIds; case "3 sai + 7 chưa làm khi count 10".

Commit message:

```bash
git commit -m "feat: create quiz sessions from prioritized card selection"
```

---

## 3. Commit 3 — E2E + dọn dead code

### 3.1 `tests/e2e/primary-navigation.spec.ts` (bắt buộc)

- Test "keeps five primary mobile destinations": **bỏ** đoạn click link "Lịch sử" trên /quiz (không còn tồn tại) + assert `/quiz?tab=history`. Thay bằng assert /quiz hiển thị nút "Bắt đầu kiểm tra".
- Test "redirects legacy primary routes": đổi `page.goto("/history")` → expect `/profile?tab=statistics` (KHÔNG còn `/quiz?tab=history`).

### 3.2 Dead code

- Xóa `src/components/shared/mode-tabs.tsx` + `src/features/learning-modes/components/mode-filter.tsx` **nếu không còn ai import** (grep toàn repo trước khi xóa).
- `src/app/(app)/quiz/[sessionId]/result/page.tsx` dòng ~201: đổi link "Xem lịch sử" từ `/history` → `/profile?tab=statistics` trực tiếp.

### 3.3 Kiểm tra thêm

- Grep toàn repo còn `tab=history` / link "Lịch sử" trên /quiz nào không → dọn sạch.

Commit message:

```bash
git commit -m "test: align navigation specs and remove dead mode components"
```

---

## 4. Verification

```bash
npm run check
npm run db:test
npm run test:e2e -- primary-navigation quiz-advancement match learning-mode-setup
git status
git diff --check
git diff --stat
git diff
```

- Chạy local reset + migration mới (`npx supabase db reset` hoặc tương đương) để xác nhận migration chain sạch.
- Kiểm tra diff: KHÔNG sửa migration cũ; KHÔNG đụng /study flow (Task 3) hay /sets; KHÔNG đụng engine runner/memory.

## 5. Commit

3 commit riêng theo §1/§2/§3, đúng phạm vi từng commit (không `git add .`).

**Không push** — chờ review (Sol) + xác nhận của điều phối.

## 6. Evidence report

- Repository: starting/final commits, push status, worktree
- Match: cách bỏ filter + áp dụng selectCardsByPriority
- Quiz: migration mới (tên file, RPC, quyền, distractor) + cách startQuiz đổi
- E2E: spec nào sửa
- Tests: files/discovered/passed/failed/skipped + pgTAP kết quả
- Files changed
- Safety: migrations YES (mới, liệt kê), DB YES, deps NO, env NO, AI NO, production NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
