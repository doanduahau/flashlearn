# Mascot hệ thống — tích hợp app-wide (Dashboard, Thống kê, Empty states)

> **Status:** verified (2026-08-14) — agent xong `f7b933c`, đối chiếu repo đạt, đã push
> **Baseline commit:** commit của Task 4 (`feat: add runner gameplay canvas session`) — task này PHỤ THUỘC module `src/features/mascot/` do Task 4 tạo; giao SAU khi Task 4 merged + verified
> **Agent tier:** Codex + GPT-5.6 Terra (cập nhật 2026-08-14: Flash free đang quá tải → chuyển sang Codex; task UI thuần, không chạm DB/security, không cần review riêng)
> **Decisions locked (user):**
>
> - Mascot: 5 level theo **current streak** 0/30/60/120/240 × 7 trạng thái, asset tại `public/mascot/level-{1..5}/{normal,happy,sad,congrats,run,thinking,point-right}.png` (đã chốt trong `mascot-plan.md` — LOCKED)
> - Rebrand CapyStudy đã xong (`3cb2aaa`): giữ màu xanh, chỉ đổi tên
> - Thứ tự: Rebrand ✅ → Task 4 (game dùng mascot) → **task này: mascot hệ thống app-wide**
> - **Dashboard greeting:** nhét mascot vào motivation bar sẵn có (happy khi đã học hôm nay / point-right khi chưa) — KHÔNG tạo section chào mừng mới (user: 1-OK)
> - **Banner mốc streak (phương án A):** hiện khi streak **== đúng mốc** {30,60,120,240} — không cần lưu trạng thái mới, không lặp ở streak giữa mốc; chúc mừng lại nếu lỡ chuỗi rồi xây lại tới mốc (user: A)
> - **Phạm vi empty states:** sets-list + collections-list + history + thống kê (user: 3-OK)
> - **Quiz result pages (happy/sad theo điểm):** task riêng sau — cần chốt ngưỡng điểm riêng (user: 4-để sau)
>   **Ngoài phạm vi:** Runner game (Task 4); quiz result pages dùng mascot happy/sad (task riêng sau — cần chốt ngưỡng điểm riêng); onboarding/hướng dẫn mới (chưa tồn tại luồng onboarding trong repo — KHÔNG tự tạo); asset mới; AI; DB; deps mới.

---

## 0. Before starting

Baseline = commit Task 4 trên `main` (or strictly newer). Chạy `git status` / `git log -5` / `git pull --ff-only`. Xác nhận `src/features/mascot/` ĐÃ TỒN TẠI (do Task 4 tạo) với: `types/mascot-types.ts` (MascotLevel 1–5, MascotState, STREAK_LEVEL_THRESHOLDS = [0,30,60,120,240]), `utils/mascot-level.ts` (`levelFromStreak`), `utils/mascot-asset.ts` (`mascotAssetPath(level, state)`), `server/load-mascot-level.ts` (server loader: records → current streak → level).

Đọc trước khi chọn tên file:

- `docs/task-prompts/mascot-plan.md` — bảng phân bổ trạng thái đã chốt (LOCKED, không đổi)
- `src/features/mascot/` (Task 4) — **tái sử dụng toàn bộ, KHÔNG duplicate logic** level/streak/asset path
- `src/app/(app)/dashboard/page.tsx` — server page hiện tại (motivation bar, stats grid, calendar)
- `src/features/statistics/components/statistics-panel.tsx` — trang thống kê (đã có `stats.current_streak`)
- Các empty state hiện có: `src/features/flashcard-sets/components/sets-list.tsx`, `src/features/special-collections/components/collections-list.tsx`, `src/app/(app)/history/page.tsx`
- Convention ảnh trong repo: kiểm tra repo có dùng `next/image` chưa (nếu chưa → dùng `<img>` thường + width/height cố định + `loading="lazy"`)

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Đưa mascot vào các màn hình hệ thống (ngoài game Runner), đúng bảng phân bổ đã chốt:

1. **Component dùng chung** `<MascotImage />` (presentational, pure) — mọi nơi dùng chung 1 component.
2. **Dashboard**: mascot trong "motivation bar" (không tạo section mới); banner ăn mừng khi streak đạt mốc.
3. **Thống kê** (`/profile?tab=statistics`): mascot cạnh header; empty state dùng mascot.
4. **Empty states**: `sets-list`, `collections-list`, `history` → mascot nhỏ trạng thái `thinking`.

KHÔNG làm: quiz result mascot (task riêng), onboarding mới, asset, AI, DB, deps mới, sửa module `src/features/mascot/`, sửa game Runner, đổi màu/design system.

## 2. Kiến trúc

```text
src/features/mascot/components/mascot-image.tsx   (mới, dùng chung — presentational)
dashboard/page.tsx (server)                       gọi loadMascotLevel → truyền level xuống
  → <DashboardMotivationBar ... /> (nâng cấp motivation bar hiện có — giữ copy cũ)
  → <StreakMilestoneBanner ... /> (mới — chỉ render khi streak == mốc)
statistics-panel.tsx (server)                     level = levelFromStreak(stats.current_streak)
  → mascot cạnh h2 + empty state
sets-list.tsx / collections-list.tsx / history    empty state: <MascotImage state="thinking" />
```

- **Server-side level:** tái sử dụng `loadMascotLevel` (Task 4) — đọc dữ liệu streak sẵn có, KHÔNG thêm query mới cho từng chỗ. Dashboard/statistics đều là server components → tính level ở server, truyền xuống client component (nếu có).
- **`<MascotImage />`:** props tối thiểu `{ level: MascotLevel; state: MascotState; size?: number; className?: string }`; render ảnh tại `mascotAssetPath(level, state)`; `alt=""` + `aria-hidden` (mascot là trang trí — mọi thông tin đều có text đi kèm); width/height = size (mặc định 96); `loading="lazy"`. KHÔNG chứa logic level/streak — chỉ render ảnh từ props.
- **KHÔNG đổi text/hành vi hiện có** của các trang — mascot chỉ thêm vào, không thay thế thông tin.

## 3. Hành vi chi tiết

### 3.1 Dashboard — motivation bar (giữ nguyên UI hiện có)

Hiện tại: section "daily-motivation" có text `"Đã nối chuỗi hôm nay! 🎉"` / `"Chưa làm bài hôm nay"` + nút Bắt đầu/Tiếp tục.

- Thêm `<MascotImage level state />` vào bên trái text trong bar này:
  - `completedToday === true` → state `happy`
  - `completedToday === false` → state `point-right` (mascot trỏ về phía nút "Bắt đầu" — đúng mục đích "chỉ tay sang phải: trỏ vào nút hành động" trong plan)
- Kích thước nhỏ gọn (mặc định 64 trong bar, responsive). Không đổi copy, không đổi nút, không đổi layout logic hiện có.

### 3.2 Dashboard — banner mốc streak (mới)

- Render khi **current streak == đúng 1 trong các mốc** {30, 60, 120, 240} (tức hôm nay người dùng vừa chạm mốc; streak > mốc thì không hiện lại).
- Nội dung: mascot `congrats` + text `"Chúc mừng! Bạn đã đạt chuỗi {streak} ngày"` (+ nhắc "giữ vững để lên level tiếp theo" nếu có mốc cao hơn). Style theo design token hiện có (surface card, border-soft, rounded-2xl/3xl — khớp các section khác của dashboard).
- Đặt giữa motivation bar và grid "Tóm tắt hôm nay".
- Level mascot trong banner = `levelFromStreak(streak)` (mốc 30 → level 2, v.v.).

### 3.3 Thống kê (`statistics-panel.tsx`)

- Cạnh `<h2>Thống kê học tập</h2>`: mascot `normal`, level = `levelFromStreak(stats.current_streak)`, kích thước nhỏ (48–64), aria-hidden.
- Empty state "Chưa có bài hoàn thành." (section "Theo chế độ") → thêm mascot nhỏ `thinking` (32–48) cạnh text. Không đổi text.
- Các error state ("Không thể tải thống kê.") KHÔNG thêm mascot.

### 3.4 Empty states app-wide

- `sets-list.tsx` / `collections-list.tsx` / `history/page.tsx`: nơi đang hiển thị empty state text ("Chưa có bộ...", v.v.) → thêm mascot `thinking` nhỏ (48) phía trên text. Chỉ nơi empty state, KHÔNG đổi text/hành vi khác. Nếu component là client và cần level → nhận level qua props từ server page; nếu không có sẵn → cho phép truyền level mặc định 1 khi chưa có dữ liệu (level không quan trọng ở empty state, nhưng phải luôn hợp lệ 1–5).

### 3.5 Accessibility & hiệu năng

- Mọi mascot trang trí: `alt=""` + `aria-hidden="true"` — text kèm theo mang ý nghĩa.
- `loading="lazy"` cho ảnh dưới fold; không lazy ảnh trong motivation bar (trên fold).
- Không `prefers-reduced-motion` cần thiết (ảnh tĩnh, không animation).
- Không overflow mobile (ảnh có kích thước cố định, không co giãn phá layout 390px).

## 4. Tests

### Unit/Component (Vitest + RTL)

- `mascot-image.test.tsx` — render đúng `src` cho từng cặp (level, state); `alt=""`; aria-hidden; size → width/height.
- `dashboard` motivation bar test (nếu có sẵn test cho dashboard — cập nhật): mascot `happy` khi completedToday, `point-right` khi chưa.
- `streak-milestone-banner.test.tsx` (nếu tách component) — render khi streak == 30/60/120/240; KHÔNG render khi 0 hoặc giữa mốc (35).
- Cập nhật test hiện có bị ảnh hưởng (nếu sets-list/collections-list/history có test assert DOM — bổ sung assert ảnh hoặc giữ nguyên nếu test không đụng).

### E2E (nếu có spec sẵn cho dashboard — cập nhật nhẹ)

- Dashboard: mascot hiển thị; banner mốc chỉ xuất hiện khi streak == mốc (dùng seed/DB state có sẵn; nếu không tạo được state mốc → bỏ case này, ghi rõ).
- Không bắt buộc spec mới cho từng empty state — ưu tiên cập nhật spec hiện có, giữ suite xanh.

## 5. Files dự kiến

```text
src/features/mascot/components/mascot-image.tsx      (mới — dùng chung)
src/app/(app)/dashboard/page.tsx                     (server: loadMascotLevel + truyền props)
src/features/dashboard/components/dashboard-motivation-bar.tsx  (mới — tách từ section hiện có, giữ nguyên copy/CTA)
src/features/dashboard/components/streak-milestone-banner.tsx  (mới)
src/features/statistics/components/statistics-panel.tsx        (mascot header + empty state)
src/features/flashcard-sets/components/sets-list.tsx           (empty state)
src/features/special-collections/components/collections-list.tsx (empty state)
src/app/(app)/history/page.tsx                                 (empty state)
tests/unit/features/mascot/mascot-image.test.tsx   (mới)
tests/unit/features/dashboard/streak-milestone-banner.test.tsx (mới)
tests/unit/features/dashboard/* (cập nhật nếu có)
tests/e2e/* (cập nhật nếu spec hiện có bị ảnh hưởng)
```

Lưu ý: nếu tách `dashboard-motivation-bar` làm phức tạp diff quá mức → có thể thêm mascot trực tiếp trong `dashboard/page.tsx` (đúng chỗ hiện có) và chỉ tách khi cần test. Ưu tiên diff tối thiểu.

## 6. Verification

```bash
npx vitest run tests/unit/features/mascot tests/unit/features/dashboard
npm run check
# E2E liên quan dashboard (nếu spec tồn tại) — cần local Supabase; nếu không chạy được, ghi rõ trong report
```

## 7. Diff review

- Không DB / AI / deps / asset / migration; không sửa `src/features/mascot/` (Task 4); không sửa game Runner; text hiện có KHÔNG đổi (chỉ thêm mascot); không overflow mobile; mọi ảnh có alt="" + aria-hidden; level luôn hợp lệ 1–5; không hardcode đường dẫn ảnh (luôn qua `mascotAssetPath`).

## 8. Commit

```bash
git add src/features/mascot/components src/app/\(app\)/dashboard src/features/dashboard/components src/features/statistics/components src/features/flashcard-sets/components src/features/special-collections/components src/app/\(app\)/history tests/unit/features/mascot tests/unit/features/dashboard
git commit -m "feat: integrate mascot across app UI"
```

Push chỉ khi: baseline Task 4 trên origin/main, mọi gate pass, diff tối thiểu, không thay đổi bất ngờ. Nếu nghi ngờ: không push.

## 9. Evidence report

- Repository: starting/final commit, push status, worktree.
- Mascot integration: từng màn hình + state/level dùng; cách level được tính (server-side, module nào).
- Tests: files/discovered/passed/failed/skipped.
- Files changed (từng file + mục đích).
- Safety: migrations NO; DB NO; deps NO; env NO; AI NO; assets NO; production NO.
- Ambiguities; Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
