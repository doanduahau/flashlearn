# CapyStudy — Task 2c: Preview thẻ có thể sửa + Google Sheets luôn hiện chọn cột + redirect xóa bộ

> **Loại:** UI import (luồng dùng chung) + fix nhỏ.
> **Tier đề xuất:** Codex + Terra (luồng import là tính năng sống, state logic — không giao model yếu). Không cần Sol review (không DB/security).
> **Baseline commit:** `0c27901` (đã push).
> **Không phụ thuộc Task 3/4/5** (file khác nhau) — nhưng nên chạy TRƯỚC Task 3 trong cùng worktree (tránh lẫn file như vụ 6b/6c).

---

## 0. Hiện trạng đã xác minh (bắt buộc đọc trước khi code)

- **Excel/CSV** (`import-wizard.tsx`): bộ chọn cột "1. Trang tính / 2. Mặt trước / 3. Mặt sau" **luôn hiển thị** sau khi parse tệp (`{!sheet ? picker : (chọn cột)}`). ✓ Đúng rồi, không đụng.
- **Google Sheets** (`google-sheets-import.tsx`): bộ chọn cột chỉ hiển thị khi `needsMapping && meaningfulColumns.length > 0` (dòng ~584). Với bảng 2 cột thông thường, `adaptSheetData` trả về `mapped` → `setNeedsMapping(false)` và **không gán `meaningfulColumns`** → **bộ chọn cột KHÔNG hiện** → user không đổi được cột. ❌ Đây là lỗi cần sửa (Phần C).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -5 --oneline
git pull --ff-only
```

Đọc trước: `src/features/imports/components/create-summary.tsx`, `src/features/imports/utils/validate-draft-cards.ts`, `src/features/flashcard-sets/components/delete-set-button.tsx`, `tests/unit/features/imports/create-summary.test.tsx`, `src/lib/constants.ts` (hằng `IMPORT_MAX_ROWS` = 2000, `IMPORT_PREVIEW_ROWS` = 100).

---

## 1. Ba phần của task (3 commit riêng)

### Phần A — fix: xóa bộ xong quay về /sets/library

File: `src/features/flashcard-sets/components/delete-set-button.tsx`

Hiện tại sau khi xóa bộ thành công: `router.replace("/sets")` (dòng trong hàm `confirm`).
Đổi thành:

```ts
router.replace("/sets/library");
```

Không thay đổi gì khác (dialog, pending, error giữ nguyên).

Commit:

```bash
git add src/features/flashcard-sets/components/delete-set-button.tsx
git commit -m "fix: return to /sets/library after deleting a set"
```

### Phần B — feat: preview thẻ CÓ THỂ SỬA trong CreateSummary

`CreateSummary` được dùng chung bởi cả 4 chế độ tạo thẻ (Dán nội dung, Google Sheets, Excel/CSV, Word/PDF) — thêm preview vào đây là tự áp dụng cho tất cả. **Chế độ Thủ công dùng form riêng (`ManualSetForm`), KHÔNG đụng.**

#### Vị trí

Preview nằm **dưới cùng, dưới khối Tên bộ + nút "Tạo bộ flashcard"** (sau khối nút, trước `error` và `children`).

#### Hành vi

1. **State thẻ có thể sửa:** `CreateSummary` nhận `sourceCards` (prop). Tạo state nội bộ khởi tạo từ `sourceCards` và **đồng bộ lại khi `sourceCards` thay đổi** (dùng `useEffect([sourceCards])`) — vì 4 caller truyền `key` khác nhau, một số key không đổi khi tái phân tích cùng số dòng, nên không được chỉ dựa vào remount. Không được để thẻ đã sửa bị giữ nhầm khi nguồn thay đổi.

2. **Validation chạy trên thẻ ĐÃ SỬA:** dùng `validateDraftCards(cards)` (đã có) — các con số (hợp lệ / trống / thiếu / trùng) phải cập nhật theo thẻ hiện tại. `canCreate` phụ thuộc validation mới. `handleCreate` gửi `validation.cards` (thẻ đã sửa) — KHÔNG gửi `sourceCards` gốc.

3. **UI mỗi dòng:**
   - Ô nhập **mặt trước** + ô nhập **mặt sau** (dùng `textarea` 2 dòng hoặc `input` — chọn cái phù hợp, mobile-first: xếp dọc, desktop có thể 2 cột).
   - Nút **Xóa dòng** (icon, `aria-label` rõ ràng như "Xóa thẻ N", kích thước chạm ≥ 44px, `type="button"`).
   - Ô nhập dùng `defaultValue` hay `value` + `onChange` — chọn đúng để gõ không bị mất focus (gợi ý: mỗi dòng là component con riêng hoặc dùng state theo index ổn định, không re-render toàn bộ list mỗi ký tự gõ).

4. **Giới hạn hiển thị:** chỉ render tối đa `IMPORT_PREVIEW_ROWS` (100) dòng đầu. Nếu tổng thẻ > 100, hiện dòng ghi chú: số thẻ còn lại **vẫn được tạo** nhưng không hiển thị. Thẻ không hiển thị vẫn giữ nguyên nội dung gốc.

5. **Xóa dòng:** bỏ thẻ khỏi danh sách → re-validate → số liệu cập nhật. Nếu xóa hết thẻ hợp lệ → `canCreate = false` + hiện trạng thái không có thẻ hợp lệ (giữ nguyên UI lỗi hiện có).

6. **Sửa thành trùng:** nếu sửa 2 dòng thành giống hệt nhau → dòng sau bị bỏ qua khi validate, con số "trùng" tăng lên (hành vi `validateDraftCards` hiện có — giữ nguyên, không đổi logic).

7. **Tiêu đề section:** ví dụ "Xem trước thẻ" — có thể chỉnh tên cho phù hợp ngôn ngữ hiện có.

#### KHÔNG được làm (trong Phần B)

- KHÔNG đụng `import-wizard.tsx`, `paste-import.tsx`, `document-import.tsx`, `file-import.tsx`, `ManualSetForm`.
- KHÔNG đụng logic chọn cột của **ImportWizard (Excel/CSV)** — nó đã hiển thị đúng.
- KHÔNG đổi contract server action `importFlashcards` (payload vẫn `{ name, cards }`).
- KHÔNG đổi `validateDraftCards` / adapter / parser.
- KHÔNG migration, dependency, env, AI.
- KHÔNG bỏ các phần đang hoạt động: metadata, warnings, over-limit, error, children (như nút "Chọn tệp khác"/"Thay tệp").

Commit:

```bash
git add src/features/imports/components/create-summary.tsx <test files>
git commit -m "feat: add editable card preview to import summary"
```

### Phần C — fix: Google Sheets LUÔN hiển thị bộ chọn cột Mặt trước / Mặt sau

File: `src/features/imports/components/google-sheets-import.tsx`

Vấn đề: bộ chọn cột chỉ hiện khi `needsMapping && meaningfulColumns.length > 0` (dòng ~584). Với bảng 2 cột thông thường, luồng tự ánh xạ (`mapped`) không gán `meaningfulColumns` và set `needsMapping = false` → **user không đổi được cột mặt trước/mặt sau**. User yêu cầu: bộ chọn cột PHẢI HIỆN TRÊN GIAO DIỆN ở mọi bảng tính đã tải.

Yêu cầu:

1. Ở trạng thái `mode === "loaded"` với sheet đã tải: **luôn render** 2 dropdown "Mặt trước" / "Mặt sau" (có sẵn, `id="gs-front-col"` / `id="gs-back-col"`) khi có ≥ 1 cột có ý nghĩa — bỏ điều kiện `needsMapping` khỏi cổng hiển thị (giữ `needsMapping` trong state nếu không gây hại, nhưng không còn là điều kiện hiển thị).

2. **Gán `meaningfulColumns` ở mọi nhánh `loaded`** — kể cả nhánh tự ánh xạ (`mapped`) hiện đang không gán. Nguồn dữ liệu: từ headers của sheet (`sheetData.headers` / `detection.columns` / `analysis.columns` tùy nhánh) — lọc cột có tên không rỗng (đúng tinh thần helper `meaningfulColumns` trong `detect-columns.ts`). Khi bảng chỉ có 1 cột, vẫn hiện picker để user chọn cột thứ 2 cho mặt sau.

3. Giữ nguyên: nút "Phân tích" (`analyzeWithMapping`), luồng `loadValues` theo cặp cột, `key` của `CreateSummary` (`sheets-${selectedSheetIndex}-${frontColumn}-${backColumn}`), cảnh báo `frontColumn === backColumn`. Mặc định 2 dropdown vẫn chọn đúng cột đã tự phát hiện.

4. KHÔNG đổi `adaptSheetData`, `detectColumns`, adapter, parser — chỉ sửa UI hiển thị + gán dữ liệu columns.

Commit:

```bash
git add src/features/imports/components/google-sheets-import.tsx <test files>
git commit -m "fix: always show front and back column pickers for google sheets"
```

---

## 2. Tests

- Phần B — cập nhật `tests/unit/features/imports/create-summary.test.tsx` (nếu có) + thêm test mới:
  - preview hiển thị thẻ (front/back) dưới nút Tạo
  - sửa front/back → validation + con số cập nhật → create gửi thẻ đã sửa
  - xóa dòng → thẻ biến mất khỏi danh sách + con số cập nhật
  - sửa 2 dòng thành trùng → dòng sau bị bỏ (đếm trùng tăng)
  - sửa thành rỗng → không thể tạo
  - nguồn mới thay thế (sourceCards đổi) → state reset về thẻ mới
  - giới hạn 100 dòng + ghi chú thẻ còn lại
- Phần C — test cho Google Sheets: bộ chọn cột render ở trạng thái loaded kể cả khi tự ánh xạ (2 cột); `meaningfulColumns` được gán ở nhánh mapped; chọn cột khác → nút Phân tích gọi đúng cặp cột mới. Nếu component test khó (gapi/next-script), test ở mức helper/state nếu tách được, hoặc chứng minh bằng E2E/unit hiện có + mô tả rõ cách chứng minh trong report.
- E2E: chạy lại `paste-import.spec.ts`, `document-import.spec.ts` (+ `mobile-first-ui` nếu liên quan) — preview mới không được phá luồng tạo bộ. Nếu có spec Google Sheets thì chạy; không có thì ghi rõ trong report.

---

## 3. Verification

```bash
npm run check
npm run test:e2e -- paste-import document-import
```

Xác nhận: thêm 1 thẻ rồi sửa thẻ đó trong preview → bộ tạo ra chứa nội dung đã sửa (test unit chứng minh payload).

---

## 4. Diff review trước khi báo cáo

```bash
git status
git diff --check
git diff --stat
```

Kiểm: không đụng file ngoài phạm vi, không `git add .`, 3 commit tách riêng đúng message (A: fix redirect — B: feat preview — C: fix GS column picker).

---

## 5. Evidence report

Báo:

- Repository: start/final commit, push status (KHÔNG push).
- Phần A: file + dòng đổi.
- Phần B: mô tả state/UI mới, cách xử lý reset khi sourceCards đổi.
- Phần C: mô tả cách bỏ cổng `needsMapping`, nguồn `meaningfulColumns` ở nhánh mapped, xác nhận bộ chọn cột hiển thị ở mọi bảng tính đã tải (kể cả 2 cột tự ánh xạ).
- Tests: file/test pass, kết quả `npm run check`, E2E.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities (dừng hỏi nếu có).
