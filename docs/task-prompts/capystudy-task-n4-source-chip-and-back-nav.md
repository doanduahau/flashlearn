# CapyStudy Task N4 — Bỏ div "Nguồn đã chọn" + nút thoát sets/library → /sets, sets/[setId] → /sets/library

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `fix: remove selected-source chip bar and simplify set back navigation`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user)

1. **Bỏ `<div aria-label="Nguồn đã chọn" class="flex flex-wrap gap-2 rounded-2xl bg-primary-soft p-3">`** ở phần chọn nguồn (Study + Quiz source selection)
2. **Nút thoát (BackButton) ở `/sets/library` điều hướng về `/sets`**; **nút thoát ở trang chi tiết 1 bộ flashcard (`/sets/[setId]`) điều hướng về `/sets/library`**

## 2. Hiện trạng (đã rà)

- Div "Nguồn đã chọn" nằm trong `src/features/source-selection/components/source-browser.tsx` (dòng ~112, `aria-label="Nguồn đã chọn"`) — hiển thị danh sách nguồn đã tick (dùng chung cho /study + /quiz + /match + /memory...)
- Các test đang assert phần này: `tests/unit/features/source-selection/source-browser.test.tsx` (getByLabelText "Nguồn đã chọn"), `tests/e2e/study-mode.spec.ts` (dòng 75–89), `tests/e2e/source-selection-scale.spec.ts` (28, 31), `tests/e2e/learning-mode-setup.spec.ts` (222–223)
- BackButton: `src/app/(app)/sets/[setId]/page.tsx` dùng `fallbackHref="/sets/library?tab=regular"`; `src/app/(app)/sets/library/page.tsx` — cần kiểm tra fallbackHref hiện tại (có thể đã "/sets")

## 3. Phạm vi task

1. **Xóa div "Nguồn đã chọn"** khỏi `source-browser.tsx` (toàn bộ khối render danh sách nguồn đã chọn — KHÔNG xóa SourceBrowser list chính, chỉ xóa chip bar đã chọn). Cập nhật/ xóa assertions liên quan trong unit + E2E (đổi sang assert cách khác nếu cần — vd vẫn assert nguồn được tick qua `aria-pressed` trên item, hoặc xóa assert cũ nếu không còn ý nghĩa)
2. **BackButton**:
   - `/sets/library` → fallback `/sets`
   - `/sets/[setId]` → fallback `/sets/library` (bỏ `?tab=regular` nếu không cần — tab mặc định là regular; nếu giữ query ổn hơn thì ghi rõ lý do)
3. **KHÔNG làm:** xóa tính năng chọn nguồn, đổi luồng study/quiz, đổi source-browser list chính, migration, docs

## 4. Chi tiết

### 4.1. source-browser.tsx

- Tìm khối `<div aria-label="Nguồn đã chọn" ...>` (kèm phần tử con hiển thị tên nguồn đã tick + nút bỏ chọn nếu có) → xóa toàn bộ khối
- Đảm bảo không còn JSX/state chết (nếu state chỉ phục vụ chip bar → dọn; nếu dùng cho chỗ khác → giữ)
- Kiểm tra có nút xóa nguồn trong chip bar không — nếu có, người dùng vẫn bỏ chọn được qua tick lại trên list (đã có `onToggle`), không cần nút riêng

### 4.2. BackButton

- `src/app/(app)/sets/library/page.tsx`: tìm `BackButton` → đổi `fallbackHref` thành `/sets`
- `src/app/(app)/sets/[setId]/page.tsx`: đổi `fallbackHref="/sets/library?tab=regular"` thành `/sets/library` (xác nhận page library đọc tab mặc định đúng — nếu cần `?tab=regular` mới hiện đúng tab thì giữ nguyên query và ghi rõ)
- Lưu ý: `BackButton` dùng `router.back()` với fallback — hành vi "về đường dẫn trước đó" giữ nguyên (Task 8b); chỉ đổi fallback

### 4.3. Tests

- Unit `source-browser.test.tsx`: bỏ/xóa các assert "Nguồn đã chọn"; nếu có test verify toggle vẫn giữ assert qua `aria-pressed`
- E2E: `study-mode.spec.ts` (75–89), `source-selection-scale.spec.ts` (28, 31), `learning-mode-setup.spec.ts` (222–223) — xóa assert chip bar cũ; giữ nguyên assert chọn nguồn qua list
- E2E `primary-navigation` hoặc spec chạm BackButton sets — verify điều hướng mới nếu có assert

## 5. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. `npm run test:e2e -- study-mode source-selection-scale learning-mode-setup primary-navigation` — pass
3. `git diff --check` sạch

## 6. Files dự kiến

- `src/features/source-selection/components/source-browser.tsx`
- `src/app/(app)/sets/library/page.tsx`
- `src/app/(app)/sets/[setId]/page.tsx`
- `tests/unit/features/source-selection/source-browser.test.tsx`
- `tests/e2e/study-mode.spec.ts`, `tests/e2e/source-selection-scale.spec.ts`, `tests/e2e/learning-mode-setup.spec.ts` (+ spec chạm BackButton sets nếu có)
- KHÔNG đụng: migration, server actions, docs

## 7. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: khối xóa trong source-browser + fallbackHref mới (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 8. Lưu ý

- Xóa chip bar KHÔNG được phá luồng chọn nguồn (tick nguồn trên list vẫn hoạt động; StickyStartBar vẫn hiển thị "N nguồn · X thẻ")
- Grep toàn repo "Nguồn đã chọn" sau khi sửa → chỉ còn trong docs (không còn trong src + tests)
