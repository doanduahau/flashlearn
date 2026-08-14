# CapyStudy — Task 6b: study lật thẻ — nút Trước/Sau không đè lên thẻ

> **Status:** delivered (2026-08-14) — dành cho Gemini (model nhiều token, không mạnh): task nhỏ, thuần UI, không cần review riêng
> **Baseline commit:** commit mới nhất trên `main` (không phụ thuộc Task 1 UX)
> **Agent tier:** Gemini — làm ĐÚNG phạm vi, không sáng tạo thêm
> **Decision locked (user):** nút "Trước"/"Sau" trong chế độ **Lật thẻ** (Học) hiện **đè lên và che nội dung thẻ** → chuyển xuống **DƯỚI thẻ** thành hàng nút riêng, không chồng lên nội dung.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước (toàn bộ file trước khi sửa):

- `src/features/study/components/study-session.tsx` — file DUY NHẤT cần sửa logic UI
- `tests/e2e/study-mode.spec.ts` — test dùng `getByRole("button", { name: /Thẻ trước/ })` và `/Thẻ tiếp theo/`
- `tests/unit/features/study/study-session.test.tsx`

## 1. Hiện trạng (đã xác minh)

Trong `study-session.tsx`, bên trong div `data-testid="study-card"`:

- Nút **Thẻ trước**: `absolute left-3 top-1/2 ... -translate-y-1/2` — nằm chồng lên mép trái thẻ.
- Nút **Thẻ tiếp theo**: `absolute right-3 top-1/2 ... -translate-y-1/2` — nằm chồng lên mép phải thẻ.
- `CardCollectionsControl` ở `absolute right-4 top-4` — **GIỮ NGUYÊN** (đây là nút bộ đặc biệt, không phải nút điều hướng).

## 2. Việc cần làm

1. **XÓA 2 nút absolute** (`Thẻ trước` / `Thẻ tiếp theo`) đang đè lên thẻ — xóa cả block button, xóa `ChevronLeft`/`ChevronRight` nếu không còn dùng (kiểm tra trước khi xóa import).
2. **THÊM 2 nút** vào hàng nút bên dưới thẻ — hàng `mt-6 flex flex-wrap items-center justify-center gap-3` hiện chứa nút "Nhấn để lật" (+ "Hoàn thành" khi ở thẻ cuối):
   - Nút **"Thẻ trước"** (icon `ChevronLeft` + text "Thẻ trước", hoặc chỉ icon với aria-label — nhưng **phải giữ nguyên `aria-label="Thẻ trước"`** vì E2E dùng role/name).
   - Nút **"Thẻ tiếp theo"** (tương tự, `aria-label="Thẻ tiếp theo"`).
   - **Giữ nguyên behavior:** `disabled={isFirst}` / `disabled={isLast}`, `onClick` gọi `goPrevious()` / `goNext()`.
   - Dùng `Button` component có sẵn (variant phù hợp với hàng hiện tại, ví dụ `variant="soft"` hoặc `variant="ghost"` — chọn theo style hàng nút hiện có).
3. **Giữ nguyên toàn bộ phần còn lại:** keyboard (Space/Enter lật, ArrowLeft/ArrowRight), swipe (pointer handlers), flip animation, progress bar, `CardCollectionsControl`, hàng "Bộ gốc"/"Trộn thứ tự", "Hoàn thành". **KHÔNG đổi bất kỳ behavior nào khác.**

## 3. Kiểm tra E2E không vỡ

`tests/e2e/study-mode.spec.ts` hiện dùng:

```ts
page.getByRole("button", { name: /Thẻ tiếp theo/ });
page.getByRole("button", { name: /Thẻ trước/ });
```

→ miễn giữ đúng `aria-label`/tên nút, các assertion này vẫn pass. Chạy lại spec này để chứng minh.

## 4. Tests

- Đọc `tests/unit/features/study/study-session.test.tsx` — cập nhật tối thiểu nếu có assertion về vị trí nút (vd: check nút nằm trong card container). Nếu không có assertion vị trí → **không cần sửa**, chỉ chạy lại để xác nhận pass.
- Thêm 1–2 assertion nếu hợp lý: sau khi click "Thẻ tiếp theo", `card.front` của thẻ sau hiển thị (nếu test hiện có pattern này thì thêm vào chỗ tương tự).

## 5. Verification

```bash
npx vitest run tests/unit/features/study/study-session.test.tsx
npm run check
npm run test:e2e -- study-mode
```

## 6. Diff review trước khi kết thúc

```bash
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra:

- Đúng phạm vi: `study-session.tsx` + test liên quan.
- KHÔNG có: migration, DB, dependency, env, AI, thay đổi engine/quiz/match/memory/runner.
- Nút Trước/Sau KHÔNG còn `absolute` chồng lên thẻ.
- Không phá keyboard/swipe/flip.

## 7. Commit

```bash
git add <task-related-files>
git commit -m "fix: move study prev/next buttons below the card"
```

**KHÔNG push** — gửi evidence report để người quản lý (tôi) review.

## 8. Evidence report

Báo:

- **Repository:** starting commit, final commit, push status (KHÔNG push), worktree.
- **Thay đổi:** tóm tắt từng file.
- **Tests:** file test, số discovered/passed/failed/skipped; kết quả `npm run check`.
- **Safety:** migrations changed NO / DB NO / dependencies NO / env NO / AI NO / production NO.
- **Ambiguities:** nếu có — ghi rõ, KHÔNG tự quyết.

---

## Ràng buộc tuyệt đối

1. CHỈ sửa file này + test liên quan — không refactor, không đụng component khác.
2. KHÔNG đổi hành vi lật thẻ / keyboard / swipe / tiến độ.
3. KHÔNG tạo component mới, KHÔNG cài dependency.
