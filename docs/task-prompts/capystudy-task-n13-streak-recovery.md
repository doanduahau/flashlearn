# CapyStudy Task N13 — Cơ chế khôi phục streak (nghỉ đúng 1 ngày + 3 bài kiểm tra) + message dashboard

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main) — **phụ thuộc Task N12 đã xong** (completed_quiz_count đếm 3 chế độ kiểm tra)
- `Agent tier`: **DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc, task chạm logic streak/DB RPC)**
- `Commit message` (1 commit duy nhất): `feat: allow streak recovery after a one-day gap`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user, đã chốt)

> "cơ chế streak: hiện tại 1 ngày ko học là mất streak, sửa thành nếu 1 ngày ko học và ngày hôm sau làm 3 bài trong chế độ kiểm tra thì có thể khôi phục streak, streak vẫn không tính ngày hôm qua(ngày ko làm bài). ở trang tổng quan hiện 'làm 3 bài chế độ kiểm tra để khôi phục streak' thay cho 'Chưa làm bài hôm nay' (với điều kiện streak chưa mất và có thể khôi phục)."

**Đã chốt:**

- Chỉ khôi phục được khi **nghỉ đúng 1 ngày** (hôm qua không có activity, hôm kia có). Nghỉ 2+ ngày → streak về 0 (mất hẳn, không cơ hội hồi)
- Ngày hôm sau làm **≥ 3 bài kiểm tra** (completed_quiz_count ≥ 3 trong ngày — 3 chế độ: quiz/match/typing, nhờ Task N12) → **nối chuỗi**: current streak = run cũ + 1 (ngày hôm nay tính, ngày nghỉ KHÔNG tính)
- Khi đang trong trạng thái "có thể khôi phục" (gap đúng 1 ngày, chưa đủ 3 bài hôm nay) → dashboard hiện **"Làm 3 bài chế độ kiểm tra để khôi phục streak"** thay cho "Chưa làm bài hôm nay"

## 2. Hiện trạng (đã rà)

- `src/features/statistics/utils/streak.ts`: `computeStreaks(activeDates, today)` — current streak đếm từ today (hoặc yesterday) lùi dần, dừng ở ngày missing đầu tiên; `computeStreakRun` tương tự
- `src/features/statistics/server/load-statistics.ts`: `loadStreakSummary` (dùng `computeStreaks`), `loadMonthlyStreakDates` (dùng `computeStreakRun`)
- Dashboard: `DashboardMotivationBar completedToday={completedToday}` + `StreakMilestoneBanner`; text "Chưa làm bài hôm nay" (tìm trong dashboard-motivation-bar)
- RPC `get_learning_statistics` (DB) — trả current_streak/longest/... (chỉ đọc daily_learning_records)
- `daily_learning_records.completed_quiz_count` — sau Task N12 đếm 3 chế độ kiểm tra (quiz+match+typing)

## 3. Thiết kế chi tiết

### 3.1. Logic streak mới (utils thuần — `src/features/statistics/utils/streak.ts`)

Mở rộng `computeStreaks` (và `computeStreakRun` nếu cần) để trả thêm trạng thái recovery:

```ts
export type StreakComputation = {
  current: number; // streak hiển thị (đã áp dụng recovery nếu đủ điều kiện)
  longest: number;
  completedToday: boolean;
  recoverable: boolean; // gap đúng 1 ngày + hôm nay chưa đủ 3 bài kiểm tra
  needsRecoveryQuizzes: number; // số bài kiểm tra còn thiếu để nối chuỗi (3 - completedTodayCount, min 0)
};
```

Quy tắc (đã chốt):

- **Bình thường (hôm nay có activity):** current = đếm từ today lùi; `recoverable = false`
- **Hôm nay chưa có activity, hôm qua có:** current = đếm từ yesterday lùi (streak chưa mất, đang chờ hôm nay — như hiện tại); `recoverable = false` (chưa gap)
- **Hôm nay chưa có, hôm qua KHÔNG có, hôm kia có (gap đúng 1 ngày):**
  - Nếu hôm nay đã làm **≥ 3 bài kiểm tra** (`completedTodayCount >= 3`) → **nối chuỗi**: current = run(hôm kia trở về trước) + 1 (hôm nay); `recoverable = false`; `completedToday = true`
  - Nếu hôm nay làm **1–2 bài** → `current` = run cũ (hiển thị streak cũ — chưa mất), `recoverable = true`, `needsRecoveryQuizzes = 3 - count`
  - Nếu hôm nay **0 bài** → `current` = run cũ, `recoverable = true`, `needsRecoveryQuizzes = 3`
- **Gap ≥ 2 ngày:** mất hẳn — current = 0 (hoặc đếm từ hôm nay nếu có activity hôm nay — xử lý: nếu hôm nay có activity → current = 1; else 0); `recoverable = false`
- **Longest:** giữ nguyên (không đổi — dài nhất mọi thời kỳ)
- **Hàm cần biết số bài kiểm tra hôm nay** (completed_quiz_count của record hôm nay) → `computeStreaks(activeDates, today, todayQuizCount)` — tham số mới (mặc định 0); hoặc trả `recoverable` dựa trên count. **Chú ý:** để tránh phá callers cũ, thêm tham số optional `todayQuizCount = 0`
- `computeStreakRun`: giữ nguyên cho calendar flame (không đổi hành vi — flame hiển thị ngày active liên tục; recovery không thêm ngày nghỉ)

### 3.2. Server load (`loadStreakSummary` + RPC)

- `loadStreakSummary`: cần `todayQuizCount` (đọc `daily_learning_records` record hôm nay → completed_quiz_count) → truyền vào `computeStreaks`; trả thêm `recoverable` + `needsRecoveryQuizzes` vào `StreakSummary` (type mở rộng — cập nhật type + callers: `app-shell` (layout), dashboard, quiz result... — kiểm tra grep `StreakSummary` và xử lý field mới mặc định false)
- RPC `get_learning_statistics`: nếu RPC tự tính streak (DB) → xem có cần đổi không. **Ưu tiên:** KHÔNG đổi RPC — UI/server dùng `loadStreakSummary` (utils thuần) cho recovery state; RPC chỉ dùng ở statistics panel (current/longest hiển thị — nếu lệch với recovery logic thì ghi rõ, cân nhắc đổi RPC sau khi Gemini review — ghi ambiguities)
- `loadMonthlyStreakDates`/`computeStreakRun`: giữ nguyên

### 3.3. Dashboard message (`src/features/dashboard/components/dashboard-motivation-bar.tsx` + `dashboard/page.tsx`)

- Tìm text "Chưa làm bài hôm nay" (dashboard-motivation-bar — kiểm tra) → khi `streakSummary.recoverable === true` → hiện **"Làm 3 bài chế độ kiểm tra để khôi phục streak"** (hoặc "Làm N bài chế độ kiểm tra để khôi phục streak" với N = needsRecoveryQuizzes — chọn 1, ghi rõ; ưu tiên dùng số cụ thể)
- Điều kiện hiện message: `recoverable === true` (streak chưa mất + gap đúng 1 ngày + chưa đủ 3 bài hôm nay)
- `dashboard/page.tsx` đã gọi `loadStreakSummary` → truyền `recoverable`/`needsRecoveryQuizzes` xuống `DashboardMotivationBar` (thêm prop — không phá prop cũ)
- KHÔNG đổi màu đỏ/gây áp lực (AGENTS: không dùng màu đỏ gây áp lực streak — dùng text thường)

### 3.4. KHÔNG làm

- Đổi submit_quiz_answer / daily_learning_records schema (Task N12 đã xong)
- Cơ chế ghi activity (Task N12), dashboard 3 chế độ (Task N14), statistics panel refresh (Task N11)

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. Unit: `tests/unit/features/statistics/streak.test.ts` (nếu có) — thêm test: bình thường, hôm qua active, gap 1 ngày + 0/1/2/3 bài hôm nay (recoverable đúng + nối chuỗi khi 3), gap 2 ngày mất hẳn, longest không đổi
3. E2E: `npm run test:e2e -- foundation dashboard primary-navigation` (spec chạm dashboard) — pass (cập nhật assert nếu spec check "Chưa làm bài hôm nay")
4. `git diff --check` sạch
5. Nếu đổi RPC `get_learning_statistics` (DB) → bắt buộc Gemini review + db reset + db:test (ghi rõ trong evidence)

## 5. Files dự kiến

- `src/features/statistics/utils/streak.ts` (logic recovery)
- `src/features/statistics/server/load-statistics.ts` (todayQuizCount + type StreakSummary mở rộng)
- `src/app/(app)/dashboard/page.tsx` + `dashboard-motivation-bar.tsx` (message)
- Callers của `StreakSummary`/`computeStreaks` (grep — app-shell, quiz result...) — cập nhật type
- Tests (unit streak + E2E dashboard nếu có)
- `supabase/migrations/...` (CHỈ khi đổi RPC — cân nhắc; ưu tiên không đổi RPC)
- KHÔNG đụng: migration cũ (nếu đổi RPC → migration MỚI additive, Gemini review), docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: computeStreaks mới (ngắn — kèm bảng case recovery)
Verification: npm run check (lint/typecheck/unit/build), vitest streak N passed, E2E <specs> N/N PASS, git diff --check
Gemini review (nếu chạm RPC): APPROVE/REJECT kèm findings
Safety: migrations NO (hoặc YES additive nếu đổi RPC — ghi rõ) · DB NO (hoặc YES) · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đây là task logic streak nhạy cảm — đọc kỹ `streak.ts` + `load-statistics.ts` + `dashboard/page.tsx` + `dashboard-motivation-bar.tsx` trước khi sửa
- "3 bài kiểm tra" = `completed_quiz_count` (sau Task N12 = quiz + match + typing hoàn thành trong ngày) — KHÔNG tính memory/runner/study
- Hiển thị: message recovery thay cho "Chưa làm bài hôm nay" CHỈ khi recoverable; các trạng thái khác giữ nguyên
- Nếu Task N12 chưa xong → vẫn làm được phần utils + dashboard (todayQuizCount đọc từ record hôm nay — completed_quiz_count hiện chỉ quiz; sau N12 tự gộp); ghi rõ
