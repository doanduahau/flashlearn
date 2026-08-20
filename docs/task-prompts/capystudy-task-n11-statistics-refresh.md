# CapyStudy Task N11 — Thống kê cá nhân: thông số gọn 2/dòng + bỏ mục + lịch sử 3 chế độ ẩn

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main) — **phụ thuộc Task N8 (typing_attempts) đã xong** (để lịch sử hiển thị typing)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: refresh profile statistics with hidden multi-mode history`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user)

> "trong phần thống kê của trang cá nhân: phần thống kê học tập các thông số tràn ra chiều dọc nhiều quá, cho 2 thông số trên 1 dòng, cỡ chữ nhỏ lại. bỏ phần 'Theo chế độ' và 'bài gần đây'. lịch sử bài kiểm tra không hiện tràn lan như thế, ẩn đi và khi người dùng nhấn vào mới điều hướng tới trang cụ thể và hiện lên. lịch sử lưu hết 3 chế độ trong kiểm tra. mỗi lịch sử đang hiện 'Cân bằng · 10/10 đúng' -> bỏ chữ thể hiện chế độ đi('Cân bằng')."

## 2. Hiện trạng (đã rà)

- `src/features/statistics/components/statistics-panel.tsx`:
  - Cards thông số: `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` (1 cột mobile → tràn dọc), value `text-2xl font-bold`
  - Section **"Theo chế độ"** (mode_breakdown) + section **"Bài gần đây"** (recent_quizzes) — cần BỎ
  - **QuizHistory** (cuối trang): list 50 quiz_sessions completed, mỗi dòng `{modeLabel} · {correct}/{actual} đúng` + ngày giờ
- `src/features/statistics/server/load-statistics.ts`: `modeLabel(mode)` map balanced→"Cân bằng"...; `loadLearningStatistics` RPC `get_learning_statistics`
- Lịch sử 3 chế độ = `quiz_sessions` (quiz) + `match_attempts` (match — S5) + `typing_attempts` (Task N8 — nếu chưa có, báo coordinator; vẫn làm quiz+match trước, typing thêm khi có)

## 3. Thiết kế chi tiết

### 3.1. Thông số gọn 2/dòng + chữ nhỏ

- Grid: **luôn 2 cột** (`grid grid-cols-2 gap-2` — mobile cũng 2, không 1)
- Chữ nhỏ: value `text-2xl` → `text-base font-bold sm:text-lg`; label giữ `text-sm text-text-secondary` (có thể `text-xs` mobile)
- Giữ 6 cards hiện tại (Chuỗi hiện tại / Chuỗi dài nhất / Hôm nay / Độ chính xác / Bài đã hoàn thành / Ngày hoạt động)

### 3.2. Bỏ "Theo chế độ" + "Bài gần đây"

- Xóa section "Theo chế độ" (mode_breakdown) + section "Bài gần đây" (recent_quizzes) khỏi `statistics-panel.tsx`
- Có thể giữ data trong `load-statistics.ts` (RPC trả về — không đụng RPC; chỉ bỏ render) — hoặc dọn field khỏi type nếu không dùng nơi khác (kiểm tra grep trước; ưu tiên chỉ bỏ render, giữ type để không phá RPC mapping)

### 3.3. Lịch sử 3 chế độ — ẩn mặc định, nhấn mới hiện

- **Mặc định:** KHÔNG hiện list dài. Thay bằng 1 ô/1 dòng gọn: tổng số bài đã hoàn thành (3 chế độ) + nút/link **"Xem lịch sử"** → điều hướng tới trang lịch sử riêng
- **Trang lịch sử riêng:** `/profile?tab=statistics&view=history` (search param `view=history` — pattern `tab`, `month` có sẵn). Khi `view=history` → statistics tab render **toàn bộ lịch sử** (thay cho cards thông số — chỉ hiện heading "Lịch sử bài kiểm tra" + list đầy đủ + nút Quay lại thống kê)
- **Gộp 3 chế độ:** query song song `quiz_sessions` + `match_attempts` + `typing_attempts` (completed_at not null), gộp 1 list, sort `completed_at desc`, giới hạn 50 (hoặc phân trang — chọn 50 + ghi rõ)
- **Mỗi dòng lịch sử:** `{correct}/{total} đúng` + ngày giờ (KHÔNG hiển thị chế độ "Cân bằng" — bỏ `modeLabel`); icon nhỏ phân biệt chế độ (vd biểu tượng/emoji quiz/match/typing — KHÔNG bắt buộc, chọn gọn; hoặc ẩn hẳn)
- Link: quiz → `/quiz/[id]/result` (có trang kết quả); match/typing → hiện thông tin không link (chưa có trang review — ghi rõ; hoặc ẩn link, chỉ text)
- Empty state: mascot thinking 64px + "Bạn chưa hoàn thành bài kiểm tra nào." (giữ pattern)

### 3.4. KHÔNG làm

- Đổi RPC `get_learning_statistics` / DB (chỉ UI + query thêm match/typing)
- Dashboard, profile tab khác, streak logic (Task N12/N13), migration, docs

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. E2E: `npm run test:e2e -- profile-settings primary-navigation quiz-result-collections` — pass (cập nhật assert nếu spec đang check "Theo chế độ"/"Bài gần đây"/history list cũ)
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/statistics/components/statistics-panel.tsx`
- `src/app/(app)/profile/page.tsx` (xử lý `view=history` — hoặc giữ trong panel, chọn 1, ghi rõ)
- `src/features/statistics/server/load-statistics.ts` (nếu cần helper gộp lịch sử 3 chế độ — ưu tiên trong panel/server action mới)
- Tests liên quan (unit + E2E)
- KHÔNG đụng: RPC, migration, dashboard, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: cards gọn + history merge (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Nếu `typing_attempts` chưa tồn tại (Task N8 chưa xong) → làm quiz+match trước, thêm typing khi có; ghi rõ trong evidence
- Grep "Theo chế độ"/"Bài gần đây"/"Cân bằng" sau khi sửa → không còn trong UI (Cân bằng vẫn có trong RPC/modeLabel — chỉ bỏ khỏi hiển thị)
- `view=history` phải giữ được khi refresh (search param, không state client)
