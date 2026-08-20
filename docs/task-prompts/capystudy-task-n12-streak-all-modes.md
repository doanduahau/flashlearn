# CapyStudy Task N12 — Streak tính cho MỌI chế độ học + kiểm tra + cập nhật ngay

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main) — **phụ thuộc Task N8 (typing) + N10 (typing UI) đã xong** (để typing ghi streak)
- `Agent tier`: **DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc, task chạm DB)**
- `Commit message` (1 commit duy nhất): `feat: record daily activity for every learning mode`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user)

> "hoàn thành bất kì chế độ nào của học và kiểm tra đều được tính streak, những chỗ hiển thị streak phải cập nhật lại ngay sau khi nối chuỗi(hoàn thành 1 chế độ) (hiện tại còn phải load lại trang)."

**Hiện trạng (đã rà):** `daily_learning_records` chỉ được ghi qua `submit_quiz_answer` (khi hoàn thành quiz). Match/Memory/Runner/Study KHÔNG ghi → không tính streak. Các chế độ: **học** = Lật thẻ (study), Memory matching, Capy runner; **kiểm tra** = Trắc nghiệm (quiz), Match, Nhập đáp án (typing).

## 2. Phạm vi task

1. **Migration mới:** RPC `record_daily_activity` (SECURITY DEFINER, service_role only) + pgTAP `034_daily_activity.sql`
2. **Gọi RPC khi hoàn thành** các chế độ: match (S5 flow), typing (Task N10 flow), memory, runner, study (lật thẻ — hiện KHÔNG có server action hoàn thành → thêm)
3. **UI streak cập nhật ngay** sau khi hoàn thành (không cần reload trang)
4. **KHÔNG làm:** cơ chế khôi phục streak (Task N13), dashboard gộp 3 chế độ (Task N14), thay đổi submit_quiz_answer, migration cũ

## 3. Thiết kế chi tiết

### 3.1. RPC `record_daily_activity` (pattern ghi daily record trong `submit_quiz_answer` — xem migration `20260806140000_secure_profile_timezone_changes.sql` để mirror timezone/local_date logic)

```sql
create or replace function public.record_daily_activity(
  p_user_id uuid,
  p_mode text,
  p_questions_answered integer,
  p_correct_answers integer
) returns void
language plpgsql security definer set search_path = ''
```

Semantics:

- `p_mode` ∈ ('quiz','match','typing','memory','runner','study') — ngoài danh sách → 22023
- Lấy timezone từ `profiles` (fallback `Asia/Ho_Chi_Minh`) — mirror logic submit_quiz_answer; tính `local_date` theo timezone đó (dùng `timezone(tz, now())` hoặc helper có sẵn — đọc migration để copy đúng cách)
- **Upsert `daily_learning_records (user_id, local_date)`**:
  - Mọi mode → record tồn tại = ngày active (streak tính)
  - Nếu `p_mode` ∈ ('quiz','match','typing') (3 chế độ kiểm tra): `completed_quiz_count += 1`, `questions_answered += p_questions_answered`, `correct_answers += p_correct_answers`
  - Nếu `p_mode` ∈ ('memory','runner','study'): **KHÔNG tăng** completed_quiz_count/questions/correct (chỉ đảm bảo record tồn tại — streak; "bài hôm nay" dashboard chỉ đếm 3 chế độ kiểm tra — Task N14)
  - Nếu `p_questions_answered` null/âm → coerce 0; `p_correct_answers` null/âm → coerce 0; đảm bảo `correct <= questions` sau cộng (clamp)
- Cập nhật `timezone` cột = timezone đã dùng
- `p_user_id` null → 42501
- Grants: `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role` (KHÔNG authenticated — client gọi qua admin server action)

### 3.2. Gọi RPC khi hoàn thành từng mode (server actions — đều dùng `createAdminClient().rpc("record_daily_activity", ...)`)

Thứ tự gọi: **sau khi hoàn thành thật sự** (sau complete coverage / save kết quả thành công), KHÔNG gọi khi game-over bỏ dở hoặc thoát giữa chừng:

1. **Match** (`src/features/match/components/match-session.tsx` — `handleComplete`): sau `saveMatchAttempt` OK → gọi `recordDailyActivity({ mode: "match", questionsAnswered: correctPairs + incorrectAttempts, correctAnswers: correctPairs })` (cùng 1 server action chung mới — xem 3.3)
2. **Typing** (Task N10 — `submitTypingAttempt`): sau `saveTypingAttempt` OK → `recordDailyActivity({ mode: "typing", questionsAnswered: total, correctAnswers: correct })`
3. **Memory** (`src/features/memory/components/memory-session.tsx` — completion): sau `completeLearningCoverageSession` OK → `recordDailyActivity({ mode: "memory", questionsAnswered: 0, correctAnswers: 0 })` (không có điểm — chỉ streak)
4. **Runner** (`src/features/runner/...` — khi status completed, sau coverage complete): → `recordDailyActivity({ mode: "runner", 0, 0 })` — runner có completedCount nhưng KHÔNG tính vào questions (chỉ streak); nếu muốn tính thì ghi rõ
5. **Study lật thẻ** (`src/features/study/components/study-session.tsx`): hiện bấm "Hoàn thành" chỉ set state client (`setIsCompleted(true)`) — **thêm server action mới** `completeStudySession()` (hoặc tương tự): auth + `recordDailyActivity({ mode: "study", 0, 0 })`; gọi khi bấm Hoàn thành (guard chống double — `completingRef` pattern match). Lỗi ghi → không chặn màn hoàn thành (hiện error nhỏ + nút thử lại — pattern S5 match save)

### 3.3. Server action chung mới

`src/features/learning-modes/server/record-activity.ts` (hoặc trong feature phù hợp — chọn 1, ghi rõ):

- `recordDailyActivity(input: { mode: "match"|"typing"|"memory"|"runner"|"study"; questionsAnswered: number; correctAnswers: number })` — "use server": zod validate + auth getClaims → `createAdminClient().rpc("record_daily_activity", { p_user_id, p_mode, p_questions_answered, p_correct_answers })` → `revalidatePath("/dashboard")` + `revalidatePath("/profile")` (để streak hiển thị mới) → `{ ok }`
- Trả về ok/error — component gọi giữ UX

### 3.4. UI streak cập nhật NGAY (không reload trang)

- Sau khi gọi `recordDailyActivity` OK, component cũng gọi **`router.refresh()`** (Next.js re-render server components — cập nhật streak shell/dashboard ngay, không reload toàn trang, giữ state client). Lưu ý: `router.refresh()` trong client component — gọi sau completion (trong `handleComplete`/`submitTypingAttempt`)
- Kiểm tra: `StreakIndicator` (app shell) + dashboard đọc streak qua server — sau refresh hiển thị mới
- KHÔNG cần state streak client-side — dùng `router.refresh()` (server-first)

### 3.5. pgTAP `034_daily_activity.sql`

Cover:

1. Boundary: SECURITY DEFINER + empty search_path; anon/authenticated không execute; service_role execute
2. Mode không hợp lệ → 22023; user null → 42501
3. Ghi quiz-mode: upsert record đúng local_date + timezone (fixture profile timezone, vd Asia/Ho_Chi_Minh); completed_quiz_count/questions/correct tăng đúng
4. Ghi match/typing-mode: completed_quiz_count tăng + questions/correct cộng đúng
5. Ghi memory/runner/study-mode: record tồn tại (streak) nhưng completed_quiz_count/questions/correct KHÔNG đổi
6. Nhiều lần cùng ngày → upsert (không trùng row); clamp correct ≤ questions
7. RLS: record vẫn select-own (authenticated đọc được record của mình)

## 4. Verification gates (bắt buộc)

1. `npx supabase db reset` TRƯỚC `npm run db:test` (supabase test db không tự reset)
2. `npm run db:test`: 36 files PASS (thêm 034), assertions tăng
3. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
4. Unit: test server action mới (mock admin RPC) + test study completion gọi record (nếu có component test)
5. E2E: `npm run test:e2e -- study-mode memory match runner-gameplay typing-mode` (nếu có) — pass; assert streak cập nhật (nếu spec có sẵn — nếu không, ghi chú)
6. `git diff --check` sạch

## 5. Files dự kiến

- `supabase/migrations/20260816170000_record_daily_activity.sql` (mới)
- `supabase/tests/034_daily_activity.sql` (mới)
- `src/features/learning-modes/server/record-activity.ts` (mới — hoặc chỗ phù hợp)
- `src/features/match/components/match-session.tsx` (gọi record sau save OK + router.refresh)
- `src/features/memory/components/memory-session.tsx` (gọi record sau complete + refresh)
- `src/features/runner/components/runner-session.tsx` (gọi record khi completed + refresh)
- `src/features/study/components/study-session.tsx` (server action hoàn thành + gọi record + refresh)
- `src/features/typing/components/typing-session.tsx` (nếu Task N10 đã xong — gọi record sau save + refresh)
- Tests liên quan
- KHÔNG đụng: submit_quiz_answer, migration cũ, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: RPC record_daily_activity (ngắn) + 1 chỗ gọi (vd match)
Verification:
- npx supabase db reset: PASS/FAIL
- npm run db:test: N files / N assertions PASS (034 = N)
- npm run check: lint X errors / Y warnings, typecheck, unit N passed, build
- E2E <specs>: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings (file:line) — BẮT BUỘC trước khi gửi
Safety: migrations YES (1 additive, đã reset+test) · DB YES · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ migration `20260806140000_secure_profile_timezone_changes.sql` (logic timezone/local_date của submit_quiz_answer — mirror đúng, KHÔNG đổi submit_quiz_answer)
- `daily_learning_records` cột: `local_date, timezone, completed_quiz_count, questions_answered, correct_answers` (đã thấy trong loadMonthlyActivity) — kiểm tra migration tạo bảng để biết tên cột + constraint chính xác
- Không ghi record khi: game-over, thoát giữa chừng, lỗi coverage/save — CHỈ khi hoàn thành thật sự
- `router.refresh()` sau ghi OK — cập nhật streak shell + dashboard ngay
- Nếu typing chưa có (Task N10 chưa xong) → làm 4 mode (match/memory/runner/study) + thiết kế typing trong RPC, gọi typing ở Task N10 polish; ghi rõ
