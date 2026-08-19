# CapyStudy Task N7 — Hồ sơ: dàn mascot cột mốc streak (5 level + mốc 30/60/120/240)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: show streak milestone mascots on profile`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user, đã chốt)

> "phần hồ sơ có thêm dàn mascot đủ các level, dưới chân là con số 30 kèm icon streak, 60 kèm icon streak... thể hiện cột mốc. cột mốc nào chưa đạt thì hơi làm mờ đi hoặc trắng đen (64x64). đang ở cột mốc nào thì kích thước 96x96. tất cả đều ở trạng thái 'happy'."

**Chốt:** dàn **5 mascot** tương ứng 5 level streak (level 1–5 theo `levelFromStreak`). Dưới chân mỗi mascot từ level 2 trở lên hiển thị **con số mốc + icon 🔥**: 30, 60, 120, 240 (level 1 không có số). Mascot **đang đạt** (level streak hiện tại) = **96×96**; **chưa đạt** = **64×64 + mờ/trắng đen**; tất cả trạng thái **happy**.

## 2. Hiện trạng (đã rà)

- `src/app/(app)/profile/page.tsx`: tab "profile" hiện chỉ có section "Hồ sơ của bạn" (tên/email/múi giờ) — server component
- Mascot: `src/features/mascot/components/mascot-image.tsx` (props: level, state, size, className), `src/features/mascot/utils/mascot-level.ts` có `levelFromStreak(streak)` (0–29→1, 30–59→2, 60–119→3, 120–239→4, 240+→5); server helper `loadMascotLevel(supabase)` (trả level từ streak) — dùng pattern có sẵn ở các page khác
- Streak indicator / loadStreakSummary: xem `src/features/statistics/server/` hoặc `loadMascotLevel` — dùng helper đã có, KHÔNG thêm query mới nếu tránh được

## 3. Thiết kế chi tiết

### 3.1. Server page (`src/app/(app)/profile/page.tsx`)

- Trong tab "profile", thêm **section "Cột mốc"** (sau section "Hồ sơ của bạn"): `rounded-3xl border border-border-soft bg-surface p-5` + heading "Cột mốc streak"
- Load streak/level: `const mascotLevel = await loadMascotLevel(supabase)` (pattern các page khác) — truyền xuống component client `MilestoneMascots` (hoặc render trực tiếp server-side nếu không cần client — mascot chỉ là img, có thể render server; chọn server-first nếu không cần tương tác)

### 3.2. Component dàn mascot (mới: `src/features/mascot/components/milestone-mascots.tsx` — server-safe, không cần "use client")

- 5 cột mốc: `[{ level: 1, milestone: null }, { level: 2, milestone: 30 }, { level: 3, milestone: 60 }, { level: 4, milestone: 120 }, { level: 5, milestone: 240 }]`
- Render hàng ngang (mobile: có thể cuộn ngang nhẹ hoặc xếp gọn `flex flex-wrap justify-center gap-4`; desktop: hàng ngang căn giữa)
- Mỗi cột mốc:
  - `MascotImage level={level} state="happy"` — **mascot đang đạt** (`level === mascotLevel`): `size={96}` className `size-24 object-contain`; **chưa đạt**: `size={64}` className `size-16 object-contain opacity-40 grayscale` (mờ + trắng đen)
  - **Dưới chân:** với level ≥ 2: `p className="text-xs font-medium"` hiển thị `30 🔥` / `60 🔥` / `120 🔥` / `240 🔥` (icon streak — dùng emoji 🔥 hoặc icon lucide `Flame` nếu dự án đang dùng lucide — chọn 1, ghi rõ). Level 1: không số (có thể ghi "Bắt đầu" hoặc để trống — chọn gọn)
  - `aria-label` tổng cho từng cột mốc: vd "Cột mốc 30 ngày streak — đã đạt / chưa đạt"
- Mascot decorative: `alt=""` / aria-hidden (mascot-image đã xử lý — kiểm tra)

### 3.3. Tests

- Unit: test component nếu viết được (render 5 mốc, đúng size/opacity theo mascotLevel, số mốc + 🔥 đúng)
- E2E: mở `/profile` → thấy section "Cột mốc" + 5 mascot + số 30/60/120/240; `npm run test:e2e -- profile-settings primary-navigation` — pass
- `npm run check` exit 0

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. E2E: profile-settings + primary-navigation — pass
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/mascot/components/milestone-mascots.tsx` (mới)
- `src/app/(app)/profile/page.tsx` (sửa — load level + render section)
- Tests liên quan (unit nếu có component test pattern; E2E)
- KHÔNG đụng: mascot-image, mascot-level utils, statistics, dashboard, migration, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: component milestone-mascots (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- 5 mascot đều `state="happy"` (đúng yêu cầu)
- Mascot đang đạt duy nhất 1 con (level streak hiện tại); các con khác mờ trắng đen
- Không thêm query DB mới nếu `loadMascotLevel` đã đủ; nếu cần streak để hiển thị "đang ở cột mốc nào" thì `loadMascotLevel` trả level — đủ
- Mobile: 5 mascot 64–96px + số dưới chân — đảm bảo không tràn ngang (flex-wrap hoặc scroll-x nhẹ nếu cần)
