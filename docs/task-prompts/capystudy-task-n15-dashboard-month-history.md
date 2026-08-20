# CapyStudy Task N15 — Dashboard: "Hoạt động tháng này" thêm link/icon xem lịch sử các tháng

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: link dashboard month activity to history view`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user)

> "trong trang tổng quan, phần hoạt động tháng này thêm icon <> tương tự như hoạt động tháng này trong phần thống kê để xem lịch sử các tháng."

Mục tiêu: trên dashboard, khối "Hoạt động tháng này" có thêm link/icon điều hướng để xem lịch sử các tháng (như ở phần thống kê — nơi có thể chuyển tháng qua `?month=`).

## 2. Hiện trạng (đã rà)

- `src/app/(app)/dashboard/page.tsx`: khối "Hoạt động tháng này" render `<MonthActivityCalendar variant="compact" />` (KHÔNG có baseHref → không chuyển tháng được)
- `src/features/statistics/components/month-activity-calendar.tsx`: variant `full` nhận `baseHref` (statistics dùng `/profile?tab=statistics`) — cho phép chuyển tháng (`?month=`)
- Statistics panel (`statistics-panel.tsx`) có `baseHref="/profile?tab=statistics"`

## 3. Thiết kế chi tiết

- Trên dashboard, trong khối "Hoạt động tháng này" (cạnh heading hoặc góc phải), thêm **link "Xem lịch sử"** (hoặc icon mũi tên `<>`/ChevronRight — chọn 1, ghi rõ) → `/profile?tab=statistics` (trang thống kê có calendar full + chuyển tháng được)
- Có thể truyền thêm `?month=<currentMonth>` để mở đúng tháng đang xem (nếu statistics giữ month — kiểm tra; nếu không cần thì bỏ)
- Style: link `text-sm underline` (pattern "Xem thống kê chi tiết" đã có dưới dashboard — đặt cùng ngôn ngữ thiết kế); hoặc icon nhỏ bên phải heading — chọn 1, ghi rõ
- Không đổi MonthActivityCalendar component (chỉ thêm link trên dashboard — KHÔNG thêm baseHref vào variant compact nếu không cần)

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. E2E: `npm run test:e2e -- foundation dashboard primary-navigation` — pass (cập nhật assert nếu spec check khối hoạt động tháng)
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/app/(app)/dashboard/page.tsx` (thêm link)
- Tests E2E nếu cần cập nhật
- KHÔNG đụng: MonthActivityCalendar (trừ khi bắt buộc — ghi rõ), statistics, migration, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: link mới (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Task nhỏ — giữ tối giản, đúng phạm vi; không đổi calendar hoặc statistics
- Link phải hoạt động trên mobile (đủ to chạm, không vỡ layout)
