# Flashlearn Mascot — kế hoạch tích hợp (LOCKED)

> **Status:** locked (2026-08-14) — các quyết định đã chốt với user; chi tiết triển khai nằm ở từng task prompt.

## Quyết định đã chốt

1. **5 level theo cột mốc streak:** 0 / 30 / 60 / 120 / 240 ngày.
2. **Level tính theo current streak** (chuỗi hiện tại) — đạt mốc 30 ngày → level 2; mất chuỗi thì tụt level tương ứng. Không dùng best streak.
3. **7 trạng thái:** `normal` (bình thường), `happy` (vui), `sad` (buồn), `congrats` (chúc mừng), `run` (chạy), `thinking` (suy nghĩ), `point-right` (chỉ tay sang phải).
4. **Tên file:** đã đổi sang ASCII kebab — `public/mascot/level-{1..5}/{normal,happy,sad,congrats,run,thinking,point-right}.png` (35 file, PNG).
5. **Rebrand:** FlashLearn → CapyStudy, chỉ đổi tên, giữ màu xanh (task riêng: `rebrand-capystudy.md`).
6. **Thứ tự:** Rebrand → Task 4 (game Runner dùng mascot) → mascot hệ thống app-wide.

## Bảng phân bổ trạng thái (đã chốt)

| Trạng thái  | Dùng ở đâu                                                            |
| ----------- | --------------------------------------------------------------------- |
| normal      | Dashboard chào mừng, trang thống kê, nơi không có sự kiện             |
| happy       | Sau khi hoàn thành bài kiểm tra/phiên học tốt; Runner ăn đúng         |
| sad         | Quiz điểm thấp; Runner ăn sai / hết mạng                              |
| congrats    | Đạt cột mốc streak mới, hoàn thành trọn vẹn; Runner hoàn thành ít sai |
| run         | Game Runner (state mặc định khi chơi)                                 |
| thinking    | Empty state "chưa có dữ liệu", lúc tải                                |
| point-right | Onboarding, hướng dẫn, trỏ vào nút hành động ("Bắt đầu học"...)       |

## Quy tắc Runner (đã chốt)

- Chơi: `run`. Ăn đúng: `happy` (~600ms). Ăn sai: `sad` (~600ms). Rồi về `run`.
- Kết thúc: hoàn thành & `wrongCount = initialLives - lives ≤ 1` → `congrats`; hoàn thành mất nhiều mạng hoặc hết mạng → `sad`.
- Level mascot trong game = level theo current streak của người chơi.

## Module dùng chung (tạo trong Task 4, dùng cho cả app-wide sau)

```text
src/features/mascot/
  types/mascot-types.ts        MascotLevel (1–5), MascotState, STREAK_LEVEL_THRESHOLDS = [0,30,60,120,240]
  utils/mascot-level.ts        levelFromStreak(streak): MascotLevel (pure)
  utils/mascot-asset.ts        mascotAssetPath(level, state): "/mascot/level-N/<state>.png" (pure)
  server/load-mascot-level.ts  server: đọc records → current streak (reuse statistics/utils/streak.ts) → level
```

## Task mascot hệ thống (sau Task 4 — prompt đã soạn)

Prompt: `mascot-system-integration.md` (Status: **delivered** — đã chốt: greeting trong motivation bar; banner mốc = phương án A (streak == đúng mốc, không lưu trạng thái); empty states = sets + collections + history + thống kê; quiz result để task sau).

- Dashboard: mascot trong motivation bar (happy / point-right) + banner mốc streak (congrats khi streak == 30/60/120/240).
- Statistics header (normal) + empty states (thinking).
- Empty states app-wide: sets-list, collections-list, history (thinking).
- Component dùng chung `<MascotImage level state size className />`.
- Onboarding/hướng dẫn (point-right) — chưa có luồng onboarding trong repo; để sau khi có luồng thật.
- Quiz result pages (happy/sad) — task riêng sau, cần chốt ngưỡng điểm.
