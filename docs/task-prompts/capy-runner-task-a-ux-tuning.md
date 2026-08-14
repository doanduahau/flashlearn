# Capy Runner — Task A: UX tuning (rename + character + speed + remove tabs)

> **Status:** verified (2026-08-14) — agent xong `46cf103`, đối chiếu repo đạt, đã push
> **Baseline commit:** `82f839e` (`feat: add runner gameplay canvas session`) — trên origin/main
> **Agent tier:** Codex + GPT-5.6 Terra (Flash free đang quá tải); KHÔNG cần review riêng (UI thuần, không đụng DB/security)
> **Decisions locked (user):**
>
> - Đổi tên hiển thị **"Flashcard Runner" → "Capy Runner"** (chỉ chuỗi hiển thị; GIỮ nguyên route `/runner`, tên folder, tên bảng DB)
> - Nhân vật trong game: **100×120px**, vị trí **~30% lệch sang trái** (KHÔNG ra giữa, không sát mép)
> - Tốc độ đồ ăn: **Dễ 4500ms / Vừa 3200ms / Khó 2400ms** mỗi món (nhanh hơn hiện tại)
> - Bỏ thanh `ModeTabs` (Memory Matching / Match) trên trang `/runner`
>   **Ngoài phạm vi:** distractor (Task B riêng — migration DB); mọi thay đổi DB; AI; deps mới; sửa engine Task 2 (`runner-state.ts`, `runner-difficulty.ts`, `types/`); mascot hệ thống (task riêng).

---

## 0. Before starting

Baseline `82f839e` on `main`. Chạy `git status` / `git log -5` / `git pull --ff-only`.

Đọc trước:

- `src/features/runner/components/runner-canvas.tsx` — hằng số kích thước/vị trí nhân vật (`CHARACTER_WIDTH/HEIGHT/MARGIN_X`, `FOOD_SIZE`, `JUMP_VELOCITY`, `GRAVITY`)
- `src/features/runner/config.ts` — bảng difficulty (`timePerItemMs`)
- `src/app/(app)/runner/page.tsx` — `ModeTabs` cần xóa + tên hiển thị
- `src/app/(app)/study/page.tsx` — thẻ "Flashcard Runner" → "Capy Runner"
- `src/features/runner/components/runner-end-overlay.tsx` — ảnh mascot kết thúc
- `tests/unit/features/runner/runner-difficulty.test.ts` — assert hằng số thời gian cần cập nhật
- `docs/LEARNING_MODES.md` — "Frozen Runner rules" (timing đang ghi 6000/4200/3000)

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

4 thay đổi UI/hiển thị:

1. **Đổi tên hiển thị** "Flashcard Runner" → "Capy Runner" ở mọi chuỗi hiển thị.
2. **Nhân vật trong game**: to lên 100×120, vị trí ~30% lệch trái.
3. **Tốc độ đồ ăn**: đổi `timePerItemMs` 6000/4200/3000 → 4500/3200/2400.
4. **Xóa `ModeTabs`** trên `/runner`.

KHÔNG đổi: DB, route, tên folder, engine Task 2, AI, deps.

## 2. Chi tiết

### 2.1 Đổi tên "Flashcard Runner" → "Capy Runner"

Chỉ thay chuỗi hiển thị (tiếng Anh "Capy Runner", giữ nguyên các chuỗi khác):

- `src/app/(app)/runner/page.tsx` — `metadata.title` + `<h1>`
- `src/app/(app)/runner/session/page.tsx` — `<h1>` trong `SessionError`
- `src/app/(app)/study/page.tsx` — text thẻ link "Flashcard Runner" → "Capy Runner" (giữ mô tả "vừa chạy vừa bắt đáp án đúng")
- `src/features/runner/config.ts` — comment đầu file
- `tests/e2e/learning-mode-setup.spec.ts` — regex `/Flashcard Runner/` → `/Capy Runner/`
- `tests/e2e/runner-setup.spec.ts` / `runner-gameplay.spec.ts` — describe title (nếu có)
- `docs/LEARNING_MODES.md` — mọi chỗ "Flashcard Runner" (tiêu đề, frozen rules) → "Capy Runner"

**KHÔNG đổi:** route `/runner`, folder `src/features/runner/`, bảng `runner_*`, `mode = 'runner'` trong DB, tên RPC.

### 2.2 Nhân vật 100×120, vị trí ~30% lệch trái

Trong `runner-canvas.tsx`:

- `CHARACTER_WIDTH = 100`, `CHARACTER_HEIGHT = 120` (thay 48/48).
- Vị trí: KHÔNG sát mép trái (24px) và KHÔNG ra giữa — đặt **x sao cho nhân vật nằm ~30% chiều rộng màn hình chơi tính từ mép trái**. Ví dụ: `x = cssWidth * 0.3 - CHARACTER_WIDTH / 2` (tâm nhân vật ở 30%) hoặc cách triển khai tương đương cho ra vị trí ~30%. Hằng số đặt rõ, dễ tinh chỉnh (ví dụ `CHARACTER_POSITION_RATIO = 0.3`).
- Hitbox va chạm hiện dùng hệ số 0.2/0.6 của kích thước → tự co giãn theo kích thước mới; giữ nguyên hệ số (không cần sửa).
- **Vật lý nhảy (`JUMP_VELOCITY`, `GRAVITY`):** nhân vật to hơn 2.5× → kiểm tra nhảy có còn vượt qua đồ ăn dễ dàng không; chỉ tinh chỉnh nhẹ nếu cần (ví dụ tăng `JUMP_VELOCITY` ~10–20%), ghi rõ đã đổi gì và vì sao. KHÔNG đổi `timePerItemMs` ở đây.
- `FOOD_SIZE`: giữ nguyên 28 trừ khi nhân vật to hơn làm đồ ăn trông quá nhỏ; nếu đổi, ghi rõ lý do + giá trị mới.
- End overlay (`runner-end-overlay.tsx`): ảnh mascot kết thúc (hiện `size-28` = 112px) — to lên một chút cho đồng bộ "mọi chỗ dùng nhân vật đều to" (ví dụ `size-36`), tùy chọn nhưng khuyến khích.
- Kiểm tra không overflow ngang ở 390px, không vỡ layout.

### 2.3 Tốc độ đồ ăn

`src/features/runner/config.ts`:

```text
easy   timePerItemMs 6000 → 4500
medium timePerItemMs 4200 → 3200
hard   timePerItemMs 3000 → 2400
```

- `lives` (3/2/1) GIỮ NGUYÊN.
- Cập nhật `tests/unit/features/runner/runner-difficulty.test.ts` cho khớp giá trị mới.
- Cập nhật `docs/LEARNING_MODES.md` "Frozen Runner rules" (timing) cho khớp 4500/3200/2400.

### 2.4 Xóa ModeTabs trên /runner

- `src/app/(app)/runner/page.tsx`: xóa import `ModeTabs` + block `<ModeTabs ...>` (Memory Matching / Match / Flashcard Runner). Trang `/runner` chỉ còn `<h1>Capy Runner</h1>` + `<RunnerSetup>`.
- **KHÔNG đụng** `src/components/shared/mode-tabs.tsx` và các trang khác (`/study`, `/memory`, `/match`, `/quiz`) — chúng giữ ModeTabs.
- Kiểm tra `tests/e2e/learning-mode-setup.spec.ts`: loop `/runner` trong các test shared (mode filter, "Tất cả N", search) vẫn pass — chúng không phụ thuộc ModeTabs; test "Kiểm tra tabs shared giữa Trắc nghiệm và Match" không liên quan `/runner`. Nếu có test assert ModeTabs trên `/runner` → cập nhật cho khớp.

## 3. Tests

- Cập nhật `runner-difficulty.test.ts` (giá trị thời gian mới; `calculateRunnerSpeed` test dùng tham số tường minh — giữ hoặc cập nhật cho khớp, không bắt buộc).
- Component test HUD/overlay không phụ thuộc kích thước canvas → không cần sửa trừ khi fail.
- `runner-session.test.tsx` dùng stub canvas/rAF — nếu assert vị trí/kích thước (không nên) thì cập nhật; ngược lại giữ nguyên.
- E2E: `runner-setup.spec.ts` + `runner-gameplay.spec.ts` + `learning-mode-setup.spec.ts` — chạy lại, đảm bảo pass sau đổi tên/xóa tabs. Assert timer "00:01" sau ~1.2s vẫn ổn với tốc độ mới (timing test không phụ thuộc tốc độ đồ ăn — chỉ phụ thuộc đồng hồ; kiểm tra lại vì `timePerItemMs` nhỏ hơn có thể làm food trôi nhanh hơn, nhưng không ảnh hưởng assert đồng hồ).

## 4. Files dự kiến

```text
src/app/(app)/runner/page.tsx                     (rename + xóa ModeTabs)
src/app/(app)/runner/session/page.tsx             (rename h1 lỗi)
src/app/(app)/study/page.tsx                      (rename thẻ link)
src/features/runner/components/runner-canvas.tsx  (100×120 + vị trí 30% + có thể tinh chỉnh jump)
src/features/runner/components/runner-end-overlay.tsx (mascot to hơn — tùy chọn)
src/features/runner/config.ts                     (timePerItemMs mới + comment)
tests/unit/features/runner/runner-difficulty.test.ts
tests/e2e/learning-mode-setup.spec.ts
tests/e2e/runner-setup.spec.ts (nếu cần)
tests/e2e/runner-gameplay.spec.ts (nếu cần)
docs/LEARNING_MODES.md                            (rename + timing mới)
```

## 5. Verification

```bash
npx vitest run tests/unit/features/runner
npm run check
npm run test:e2e -- runner-setup runner-gameplay learning-mode-setup   # cần local Supabase (scripts/test-e2e-local.mjs)
```

## 6. Diff review

- Không DB / AI / deps / migration / route; không sửa engine Task 2; không sửa `mode-tabs.tsx` và các trang khác; chuỗi hiển thị đổi đúng "Capy Runner"; không hardcode màu/magic number mới (đặt hằng số rõ tên); không overflow mobile; jump chỉ tinh chỉnh nếu cần và có lý do.

## 7. Commit

```bash
git add src/app/\(app\)/runner src/app/\(app\)/study src/features/runner tests/unit/features/runner tests/e2e/learning-mode-setup.spec.ts docs/LEARNING_MODES.md
git commit -m "feat: retune capy runner UX"
```

Push chỉ khi: baseline trên origin/main, mọi gate pass, diff đúng scope. Nếu nghi ngờ: không push.

## 8. Evidence report

- Repository: starting/final commit, push status, worktree.
- Thay đổi: từng điểm (rename ở đâu; kích thước/vị trí nhân vật giá trị nào; timing mới; ModeTabs xóa ở đâu).
- Tests: files/discovered/passed/failed/skipped.
- Files changed; Safety: migrations NO; DB NO; deps NO; env NO; AI NO; production NO.
- Ambiguities; Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
