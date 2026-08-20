# CapyStudy Task N10 — Typing mode UI (thẻ thứ 3 ở /quiz/mode + session nhập đáp án + kết quả)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main) — **phụ thuộc Task N8 (DB) + N9 (algorithm) đã xong** (chạy trên baseline có 2 task đó — coordinator sẽ cho biết commit baseline chính xác khi giao)
- `Agent tier`: DeepSeek Flash + Gemini (UI + server action — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: add typing quiz mode with answer matching`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> "thêm 1 chế độ kiểm tra: hệ thống hiển thị câu hỏi là nội dung mặt trước của flashcard, người dùng nhập nội dung mặt sau, có 2 nút câu trước và câu sau, khi làm hết có nút nộp bài. lúc này AI của hệ thống sẽ so đáp án người dùng nhập và đáp án (mặt sau) của flashcard xem có cùng ngôn ngữ, tương đồng về mặt ý nghĩa thì tính đúng. trang trả kết quả giống với kiểm tra trắc nghiệm. chọn số lượng câu hỏi cũng giống kiểm tra trắc nghiệm."

> "chấm kết quả điền đáp án như sau: hệ thống sẽ chấm trước, nếu có câu sai thì AI sẽ dò, nếu giống về mặt ý nghĩa và cùng ngôn ngữ thì tính đúng. mọi chế độ trong kiểm tra được đối xử như nhau: tính câu sai, câu chưa làm, tỉ lệ chính xác..."

**Đã chốt:**

- Thẻ thứ 3 ở `/quiz/mode` (tên "Nhập đáp án"); chọn số câu giống trắc nghiệm (min 10, quick 10/20/30/50, max = tổng)
- **Chấm 2 bước:** local trước (Task N9 `isAnswerCorrect`) → câu local SAI → AI dò (Task N9 `gradeTypingAnswer` — Gemini, cùng ngôn ngữ + giống nghĩa → đúng); AI lỗi → giữ local
- **3 chế độ kiểm tra đối xử:** typing ghi `mode_answer_events` per-card (bảng N8) + mở rộng `loadWrongAnswerCardIds` gộp quiz+match+typing (latest answer sai) → typing session ưu tiên "câu sai" đúng nghĩa
- Kết quả **giống quiz result** (mascot happy/sad theo 60% + X/Y đúng (Z%) + review + Chơi lại/Quay lại)

## 2. Phạm vi task

1. **/quiz/mode:** thêm card thứ 3 "Nhập đáp án" (chọn số câu giống Trắc nghiệm → Bắt đầu)
2. **Server action `startTypingSession`** (pattern `startMatchCoverageSession`): source + count → load cards → eligibility (count ≤ total, ≥ QUIZ_MIN_QUESTIONS) → `selectCardsByPriority` (sai → chưa làm → random) → tạo coverage session mode `typing` (Task N8) → trả cards (front/back) + coverageSessionId
3. **Route `/typing/session`** (client session): hiển thị từng câu (front) + input nhập đáp án + nút **Câu trước / Câu sau** (điều hướng tự do, sửa đáp án được) + thanh tiến độ + **Nộp bài** khi làm hết
4. **Nộp bài:** chấm 2 bước (`gradeTypingAnswer` — local → AI cho câu sai; đáp án cuối cùng mỗi câu) → `completeLearningCoverageSession` (coverage) → `saveTypingAttempt` (RPC N8, correct theo kết quả sau AI) → **ghi `mode_answer_events`** per-card (RPC N8 `record_mode_answers`) → **màn kết quả giống quiz result** (mascot happy/sad 60% + X/Y đúng (Z%) + review từng câu: front + "Đáp án của bạn" + "Đáp án đúng" + đúng/sai badge + Chơi lại/Quay lại)
5. **Mở rộng `loadWrongAnswerCardIds`** (practice-coverage): gộp `mode_answer_events` — latest answer per card (quiz qua quiz_questions + match/typing qua mode_answer_events) sai → wrong (đối xử 3 chế độ)
6. **E2E** typing flow
7. **KHÔNG làm:** streak ghi nhận cho typing (Task N12), match ghi events (Task N14), quiz/memory/runner/study khác, DB (Task N8 đã xong), migration

## 3. Thiết kế chi tiết

### 3.1. /quiz/mode — card thứ 3 (`src/features/quiz/components/quiz-mode-select.tsx`)

- Thêm card "Nhập đáp án" (sau Match): mascot `normal` (hoặc `thinking` — chọn 1, ghi rõ) 96×96, title "Nhập đáp án", desc ngắn (vd "Gõ đáp án theo cách của bạn" — copy mới, ghi rõ), count = typingEligible (số thẻ hợp lệ — truyền từ server page qua props mới, pattern `matchEligible`)
- Enabled khi `typingEligible >= QUIZ_MIN_QUESTIONS` (10); disabled + "Cần tối thiểu 10 thẻ — phạm vi hiện có N thẻ" khi thiếu
- Expand (pattern `quizExpanded`): chọn số câu quick 10/20/30/50 + "Tất cả N" (giống quizOptions — tái dùng logic) → nút "Bắt đầu" → `router.push(\`/typing/session?${sourceQuery}&count=N\`)`
- Server page `/quiz/mode` (tìm `src/app/(app)/quiz/mode/page.tsx`) — thêm tính typingEligible (đếm thẻ hợp lệ: tổng thẻ trong phạm vi ≥ 10? pattern match — đơn giản: đếm thẻ phạm vi đã chọn, giống quizTotal; ghi rõ cách tính)

### 3.2. Server action `startTypingSession` (`src/features/typing/server/actions.ts` — feature mới)

Pattern `startMatchCoverageSession` (đọc `src/features/match/server/actions.ts`):

- Zod schema `typingStartSchema`: source (all/setIds/collectionIds) + `questionCount` (int, min 1, max 100 — dùng QUIZ_MAX_QUESTIONS)
- Auth `getClaims` → user_id
- Load cards (front/back/id — tái dùng logic loadCards của match — copy có chừng mực vào feature typing hoặc trích helper chung; ưu tiên không đụng match — ghi rõ lựa chọn)
- `getTypingEligibility(cards)` — đơn giản: questionCount phải ≤ cards.length và ≥ 10; trả availableCounts (10/20/30/50/total) — giống pattern quiz options
- Shuffle + `selectCardsByPriority` (wrong → unseen → random) → selected cards (đủ count)
- `createAdminClient().rpc("create_learning_coverage_session", { p_user_id, p_mode: "typing", p_session_card_ids, p_scope_card_ids })` (Task N8 đã mở mode typing)
- Trả `{ coverageSessionId, cards: selected (id, front, back, position), selectedCount, eligibleCount }`

### 3.3. Route `/typing/session` (`src/app/(app)/typing/session/page.tsx` + component client)

- Page server: đọc search params (source + count) → render `<TypingSession>` (pattern match/session page)
- `TypingSession` ("use client"): load session qua `startTypingSession` → hiển thị:
  - Thanh tiến độ "N / total" + tiến trình
  - **Câu hỏi (front)** — card lớn căn giữa (style thẻ lật/study)
  - **Input đáp án** — `textarea` hoặc `input` (chọn 1; textarea cho đáp án dài, autosize) — lưu đáp án per câu vào state map `answers: Record<index, string>`
  - Nút **"Câu trước" / "Câu sau"** (không disabled giữa chừng — người dùng tự do quay lại sửa; "Câu sau" từ câu cuối → có thể ẩn hoặc đổi nhãn)
  - Khi đã qua câu cuối (hoặc nút riêng): **"Nộp bài"** hiện rõ (khi mọi câu đã có đáp án? hay luôn hiện? — chốt: nộp được khi đã trả lời hết; nếu còn trống → cảnh báo "Còn N câu chưa trả lời" + cho nộp với câu trống = sai — ghi rõ quyết định)
  - Keyboard: Enter để chuyển câu sau (trong input — không submit form), Shift+Enter xuống dòng
  - `SessionExitButton` (pattern match-session) + `useVisibilityPause` (pattern match — giữ pause khi tab ẩn)
- **Nộp bài** (`submitTypingAttempt` trong component — gọi server action `submitTypingAttempt` server-side, KHÔNG chấm ở client):
  1. Server action `submitTypingAttempt` ("use server"): nhận answers (array `[{ index, answer }]`) + coverageSessionId → **chấm 2 bước** server-side: mỗi câu `gradeTypingAnswer(answer, correctAnswer)` (local trước → AI cho câu sai; song song/batch theo N9) → `correctCount` (đáp án cuối cùng mỗi câu)
  2. `completeLearningCoverageSession(coverageSessionId)` (lỗi → hiện error nhỏ, không chặn kết quả — pattern match)
  3. `saveTypingAttempt` (RPC N8 — totalQuestions + correctQuestions (sau AI) + elapsedMs)
  4. **`recordModeAnswers`** (RPC N8 `record_mode_answers`, mode 'typing') — ghi per-card `{ flashcard_id, is_correct }` cho MỌI câu (đúng + sai) — đối xử 3 chế độ
  5. Lỗi lưu/batch → hiện "Không thể lưu kết quả" + nút Thử lại lưu (không chặn màn kết quả — pattern S5 match); guard chống double-submit (`completingRef`)
  6. Trả về per-câu kết quả (đúng/sai + đáp án chuẩn) để component render review + màn kết quả
- **Màn kết quả** (render trong session — pattern quiz result style):
  - Mascot `happy` (≥60%) / `sad` (<60%), level từ streak (`loadMascotLevel`/`levelFromStreak` — page server truyền `mascotLevel`)
  - Heading "Kết quả kiểm tra" + "X/Y đúng (Z%)"
  - Nút **"Chơi lại"** (→ `/typing/session?${giữ source+count}` — session mới; hoặc `/quiz/mode` — chọn: Chơi lại = session mới cùng cấu hình, Quay lại = `/quiz/mode`) — ghi rõ lựa chọn
  - Nút **"Quay lại"** (BackButton → `/quiz/mode`)
  - **Review câu trả lời:** từng câu — "1. {front}", "Đáp án của bạn: {input}" (màu danger nếu sai), "Đáp án đúng: {back}" (màu success nếu sai), badge "Đúng"/"Sai" (icon + text — không chỉ màu, accessibility)
  - KHÔNG làm streak section (Task N12 sẽ thêm)

### 3.4. Mở rộng `loadWrongAnswerCardIds` (`src/features/practice-coverage/server/actions.ts`)

- Hiện chỉ đọc `quiz_questions` (latest completed quiz answer) — mở rộng: **latest answer per card gộp 3 chế độ** (quiz + match/typing qua `mode_answer_events`)
- Quy tắc (đối xử): merge tất cả answers của card (quiz_questions answered + mode_answer_events) → lấy **1 bản ghi mới nhất** (answered_at desc, tie-break id desc) → nếu là SAI → wrong; đúng → không wrong ("câu sai rồi trả lời đúng → thành đúng")
- Giữ pagination/batch pattern hiện có (WRONG_ANSWER_PAGE_SIZE) — query thêm `mode_answer_events` theo flashcard_id, gộp + sort trong code
- KHÔNG đổi quy tắc dùng ở nơi khác (match/quiz/memory/runner đều dùng helper này — tự đồng bộ)

### 3.5. E2E (`tests/e2e/typing-mode.spec.ts`)

- /quiz/mode hiển thị card "Nhập đáp án" + disabled khi < 10 thẻ (nếu fixture nhỏ — tùy chọn)
- Flow: chọn typing → chọn số câu → session → nhập đáp án câu đầu (đúng + sai) → Câu sau → Nộp bài → kết quả hiển thị X/Y đúng + review
- E2E KHÔNG gọi Gemini thật — mock `gradeTypingAnswer`/AI module (pattern `FLASHLEARN_*_MOCK` — xem docs; nếu chưa có mock cho typing, thêm mock test-only, ghi rõ)
- `npm run test:e2e -- typing-mode quiz-advancement learning-mode-setup` — pass

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit: `tests/unit/features/typing/` — test `startTypingSession` action (mock), component typing-session (render câu, điều hướng trước/sau, nộp, kết quả) — theo pattern test match-session
3. E2E typing-mode + quiz-advancement — pass
4. `git diff --check` sạch

## 5. Files dự kiến

- `src/app/(app)/typing/session/page.tsx` (mới)
- `src/features/typing/components/typing-session.tsx` (mới)
- `src/features/typing/server/actions.ts` (mới — startTypingSession + submitTypingAttempt + recordModeAnswers)
- `src/features/typing/schemas/typing-schema.ts` (mới)
- `src/features/typing/types/typing-types.ts` (mới — nếu cần)
- `src/features/practice-coverage/server/actions.ts` (sửa — loadWrongAnswerCardIds gộp 3 chế độ)
- `src/features/quiz/components/quiz-mode-select.tsx` (sửa — card thứ 3)
- `src/app/(app)/quiz/mode/page.tsx` (sửa — typingEligible)
- `src/lib/supabase/types.ts` (regen — nếu cần cho RPC mới)
- Tests unit + E2E
- KHÔNG đụng: match/quiz/memory/runner/study khác, migration, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: startTypingSession + nộp bài + màn kết quả (ngắn)
Verification: npm run check (lint/typecheck/unit/build), vitest typing N passed, E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO (dùng RPC Task N8 đã apply) · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ pattern: `match/server/actions.ts` (start session), `match-session.tsx` (exit + pause + guard + retry save), `quiz-mode-select.tsx` (card + expand + count options), `quiz/[sessionId]/result/page.tsx` (style kết quả)
- Chấm điểm DÙNG `isAnswerCorrect` từ Task N9 (`@/features/typing/utils/answer-match`) — KHÔNG tự viết lại
- `saveTypingAttempt` gọi RPC `save_typing_attempt` (Task N8) — nếu RPC chưa có (Task N8 chưa giao xong) → báo coordinator, KHÔNG tự ý đổi migration
- Elapsed đo từ lúc session load → nộp (pattern match `startedAtRef`)
- Đáp án trống khi nộp = sai (chấm như sai, không crash)
- Mobile-first: input to, dễ gõ, nút trước/sau to — thao tác 1 tay
