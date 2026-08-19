# CapyStudy Task N14 — Dashboard gộp 3 chế độ kiểm tra (cần ôn = thẻ sai bất kỳ chế độ, chưa học) + Match ghi per-card events

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main) — **phụ thuộc Task N8 (mode_answer_events + RPC) + N10 (loadWrong gộp 3 chế độ) + N12 (daily activity gộp) đã xong**
- `Agent tier`: DeepSeek Flash + Gemini (UI + logic — KHÔNG chạm DB mới → **không review riêng**; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: aggregate dashboard metrics across quiz modes`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> "ở trang tổng quan: độ chính xác, bài hôm nay, cần ôn, chưa học tính chung cho tất cả chế độ kiểm tra(3 chế độ)." + "mọi chế độ trong kiểm tra được đối xử như nhau: tính câu sai, câu chưa làm, tỉ lệ chính xác..."

**Đã chốt:**

- **Độ chính xác + Bài hôm nay:** gộp 3 chế độ — tự đúng sau Task N12 (`daily_learning_records` gộp quiz+match+typing). Task này chỉ VERIFY
- **Cần ôn = thẻ có latest answer SAI ở bất kỳ chế độ** (quiz + match + typing)
- **Chưa học = thẻ chưa xuất hiện trong bất kỳ chế độ nào**
- Bảng `mode_answer_events` + RPC `record_mode_answers` **đã có từ Task N8** (KHÔNG migration mới ở task này) — match cần **ghi events** khi hoàn thành; typing đã ghi ở Task N10

## 2. Phạm vi task

1. **Match ghi per-card events:** match-state theo dõi thẻ đúng/sai + match-session gọi `record_mode_answers` (mode 'match') khi hoàn thành
2. **Dashboard counts:** "Cần ôn" + "Chưa học" theo định nghĩa mới (thay FSRS counts hiện tại) + VERIFY "Độ chính xác/Bài hôm nay" đã gộp
3. **KHÔNG làm:** migration (N8 đã có bảng/RPC), typing events (N10 đã ghi), streak (N12/N13), thống kê trang cá nhân (N11)

## 3. Thiết kế chi tiết

### 3.1. Match — ghi per-card events

- `src/features/match/utils/match-state.ts`: thêm theo dõi thẻ sai — `wrongCardIds: string[]` vào `MatchState` (init `[]`; trong `resolvePair` khi sai → push cả `frontId` + `backId`; giữ qua advanceBatch — đếm toàn phiên). `matchedFrontIds`/`matchedBackIds` đã có (thẻ đúng)
- `match-board.tsx`: mở rộng `MatchCompletionStats` → `{ correctPairs, incorrectAttempts, correctCardIds: string[], wrongCardIds: string[] }` (correctCardIds = union matchedFrontIds + matchedBackIds)
- `match-session.tsx` `handleComplete`: sau `saveMatchAttempt` OK → gọi server action `recordModeAnswers({ mode: "match", answers: [...] })` (mỗi thẻ đúng → `{ flashcard_id, is_correct: true }`, thẻ sai → false) — 1 event/thẻ/phiên; lỗi ghi events → không chặn màn hoàn thành (hiện error nhỏ + thử lại — pattern S5 match save)
- Server action `recordModeAnswers` (dùng chung — `src/features/learning-modes/server/record-mode-answers.ts` hoặc feature typing/match — chọn 1, ghi rõ): zod validate (mode + answers ≤ 200) + auth getClaims → `createAdminClient().rpc("record_mode_answers", { p_user_id, p_mode, p_answers })`

### 3.2. Dashboard counts (server page `src/app/(app)/dashboard/page.tsx`)

- **"Cần ôn"** = số thẻ có latest answer SAI (gộp 3 chế độ) — tái dùng logic/helper: xem `loadWrongAnswerCardIds` (Task N10 đã gộp) — tạo helper đọc count (không cần ids — count per user):
  - Query latest answer per card (quiz_questions + mode_answer_events) sai → count
  - Helper mới `loadWrongCardCount(supabase, userId)` trong `src/features/dashboard/server/` hoặc tái dùng practice-coverage (chọn 1, ghi rõ — ưu tiên helper riêng đếm, tránh tải toàn bộ ids nếu được)
- **"Chưa học"** = tổng thẻ user − thẻ đã xuất hiện (có bất kỳ answer nào: card_review_events OR mode_answer_events OR quiz_questions) — helper `loadUntouchedCardCount`
- Thay `countDueCards`/`countNewCards` (FSRS) làm số hiển thị "Cần ôn"/"Chưa học" trên dashboard
- **Buttons:** `StartSmartReviewButton`/`StartNewCardsButton` (trỏ smart-review/new-cards FSRS) — **giữ nguyên behavior cũ** (không phá flow học tồn tại) nhưng chỉ hiển thị khi số tương ứng > 0 (ghi rõ quyết định trong evidence; nếu user muốn bỏ sau thì task riêng)
- **"Độ chính xác" + "Bài hôm nay":** đã gộp qua `daily_learning_records` (Task N12) — verify hiển thị đúng (không đổi code nếu đúng)

### 3.3. KHÔNG làm

- Migration/RPC (N8 đã có), typing events (N10), `loadWrongAnswerCardIds` (N10 đã gộp — chỉ dùng lại), streak, thống kê cá nhân, quiz/memory/runner/study, docs

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit: match-state wrongCardIds + match-session ghi events (mock RPC); dashboard counts helper
3. E2E: `npm run test:e2e -- match typing-mode dashboard foundation` — pass
4. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/match/utils/match-state.ts` + `match-board.tsx` + `match-session.tsx` (per-card)
- `src/features/learning-modes/server/record-mode-answers.ts` (mới — server action dùng chung)
- `src/app/(app)/dashboard/page.tsx` + `dashboard-learning-status.tsx` (counts mới + buttons)
- Server helper đếm cần ôn/chưa học (`src/features/dashboard/server/` — mới)
- Tests liên quan
- KHÔNG đụng: migration, quiz_sessions, submit_quiz_answer, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: match per-card + dashboard counts (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO (dùng RPC/bảng N8) · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ: match-state/match-board/match-session (đã sửa nhiều qua S5 + 8c — đừng phá), dashboard page hiện tại, `loadWrongAnswerCardIds` (Task N10 — nếu chưa có, báo coordinator)
- "Cần ôn" = latest answer sai — quy tắc đã thống nhất (câu sai rồi trả lời đúng → hết cần ôn); viết test
- Buttons smart-review/new-cards: giữ nguyên behavior — chỉ đổi số + điều kiện hiển thị; ghi rõ quyết định
- Nếu Task N10/N12 chưa xong → báo coordinator, làm match part trước
