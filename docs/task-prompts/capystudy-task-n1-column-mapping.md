# CapyStudy Task N1 — Chọn cột mặt trước/mặt sau bất kỳ (Google Sheets + Excel)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash + Gemini (UI — không review riêng; coordinator verify)
- `Commit message` (1 commit duy nhất): `feat: allow picking any front/back column for sheets and excel`
- `Push`: KHÔNG push — gửi evidence report

## 1. Yêu cầu (từ user)

> "sheets và excel chưa thể chọn cột cho mặt trước và mặt sau (vd: mặt trước: cột 3, mặt sau: cột 2)"

Mục tiêu: người dùng phải **luôn chọn được BẤT KỲ cột nào** trong file làm mặt trước/mặt sau — kể cả cột không có header. Hiện trạng (đã rà):

- **Google Sheets** (`src/features/imports/components/google-sheets-import.tsx`): đã có dropdown "Mặt trước"/"Mặt sau" nhưng `meaningfulColumns` được filter `c.name.length > 0` (chỉ cột có header không rỗng) → **cột có header trống/thiếu KHÔNG chọn được**
- **Excel** (`src/features/imports/components/import-wizard.tsx`): dropdown "2. Mặt trước"/"3. Mặt sau" dùng `options = headers.map(...)` hiển thị `header.trim() || "Cột trống" (index+1)` — vẫn chọn được index nhưng nhãn khó hiểu ("Cột trống (3)"), và dựa vào `rows[0]` làm header (nếu dòng 1 là dữ liệu thì nhãn sai)
- Google Sheets đã có re-analyze khi đổi cột (Task 8g — `scheduleReanalysis` debounce 250ms); Excel summary tự cập nhật qua `useMemo` theo `frontColumn`/`backColumn`

## 2. Phạm vi task (chỉ làm đúng những mục này)

1. **Google Sheets:** `meaningfulColumns` phải bao gồm MỌI cột của sheet (không filter bỏ cột header trống) — nhãn hiển thị = `header.trim() || columnIndexToLetters(index)`; dropdown chọn cột **luôn hiển thị** khi đã load sheet (không chỉ khi `needs_mapping`)
2. **Excel:** `options` dùng nhãn A1-notation thống nhất — `header.trim() || columnIndexToLetters(index)` (tái dùng util `columnIndexToLetters` từ `@/features/imports/utils/sheets-a1` — GS đã dùng); vẫn chọn được mọi cột; đổi cột → summary/preview/count cập nhật ngay (useMemo đã làm, chỉ verify)
3. **Verify E2E:** chọn cột khác (vd cột 3 làm mặt trước, cột 2 làm mặt sau) → preview + số thẻ đổi theo; cột không có header vẫn chọn được
4. **Không làm:** luồng import/create, semantic single-column, document (docx/pdf), CreateSummary, thay đổi server actions

## 3. Chi tiết

### 3.1. Google Sheets (`google-sheets-import.tsx`)

- Trong `handleDiscovered`: thay vì `headers.map(...).filter((c) => c.name.length > 0)`, dùng **tất cả cột** có trong headers (0..headers.length-1), nhãn = `name.trim() || columnIndexToLetters(index)`:

```ts
const meaningful = headers.map((name, index) => ({
  index,
  name: name.trim() || columnIndexToLetters(index),
}));
```

- Kiểm tra các nơi khác build `meaningfulColumns` (nếu có trong `applyAnalysis` nhánh `needs_mapping`) — áp dụng cùng quy tắc
- Dropdown "Mặt trước"/"Mặt sau" render khi `meaningfulColumns.length > 0` — sau thay đổi trên luôn > 0 khi có sheet → **luôn hiện**; giữ nguyên `scheduleReanalysis` (đổi cột → preview đổi sau 250ms)
- `columnIndexToLetters` đã import sẵn trong file (kiểm tra) — nếu chưa, thêm import

### 3.2. Excel (`import-wizard.tsx`)

- Đổi `options`:

```ts
const options = headers.map((header, index) => (
  <option key={index} value={index}>
    {header.trim() || columnIndexToLetters(index)}
  </option>
));
```

- Import `columnIndexToLetters` từ `@/features/imports/utils/sheets-a1`
- Giữ nguyên: đổi cột → `summary` useMemo tự tính lại (preview + count); guard `frontColumn === backColumn` ("phải dùng hai cột khác nhau")
- Nếu file không có header (dòng 1 là dữ liệu): nhãn cột vẫn là "A", "B", "C"... và chọn được (hành vi hiện tại vẫn đúng vì options theo index)

### 3.3. Tests

- Unit: cập nhật/nếu có test cho `import-wizard`/`google-sheets-import` (kiểm tra nhãn cột mới; nếu không có test component cho GS — ghi chú, không bắt buộc tạo mới nếu phụ thuộc gapi)
- E2E: cập nhật spec liên quan (document-import / paste-import / unified-editor nếu assert nhãn cột cũ "Cột trống"); thêm case chọn cột 3/cột 2 nếu khả thi

## 4. Verification gates (bắt buộc)

1. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
2. `npm run test:e2e -- document-import paste-import unified-editor` (và spec chạm nhãn cột) — pass
3. `git diff --check` sạch

## 5. Files dự kiến

- `src/features/imports/components/google-sheets-import.tsx` (sửa)
- `src/features/imports/components/import-wizard.tsx` (sửa)
- `tests/e2e/*` liên quan (nếu assert nhãn cũ)
- KHÔNG đụng: server actions, adapter, detect-columns, CreateSummary, document-import, paste-import, migration, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: meaningfulColumns mới + options mới (ngắn)
Verification: npm run check (lint/typecheck/unit/build), E2E <specs> N/N PASS, git diff --check
Safety: migrations/DB NO · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý

- Không thay đổi luồng import/create hiện có — chỉ sửa khả năng chọn cột + nhãn
- `columnIndexToLetters(0)` = "A", `columnIndexToLetters(1)` = "B", ... — dùng util có sẵn, KHÔNG tự viết lại
- Đọc kỹ file hiện tại trước khi sửa (có nhiều nhánh applyAnalysis/handleDiscovered)
