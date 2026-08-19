# CapyStudy — Task 8g: Google Sheets — đổi cột Mặt trước/Mặt sau phải cập nhật preview

> **Loại:** bug fix import — vừa.
> **Tier:** Codex + Terra — không review riêng (không DB; client logic).
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7, 8a–8f đã push — vì file này Task 7 đã sửa).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 1 commit. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh (đã làm rõ với user)

User xác nhận: **dropdown chọn cột Mặt trước/Mặt sau đã hiển thị được** (Task 2c đã sửa). NHƯNG:

> "khi bấm phân tích và hiện preview thì chọn mặt trước và mặt sau không có tác dụng nữa, phần preview không đổi theo."

→ **Bug thật:** sau khi bấm "Phân tích" và `CreateSummary` (preview) hiện ra, đổi cột Mặt trước/Mặt sau **không làm preview đổi theo**.

## 1. Nguyên nhân (đã xác định trong code)

`src/features/imports/components/google-sheets-import.tsx`:

- Dropdown Mặt trước/Mặt sau: `onChange={(e) => setFrontColumn(Number(e.target.value))}` / `setBackColumn(...)` — chỉ set state, **không hề gọi lại phân tích**.
- `CreateSummary` có `key={`sheets-${selectedSheetIndex}-${frontColumn}-${backColumn}`}` → khi đổi cột, key đổi → component remount — nhưng `fullCards` (state) **không đổi** vì không có bước nào tính lại cards từ cột mới → preview giữ nguyên dữ liệu cũ (chỉ remount với cùng cards).
- Chỉ khi bấm nút **"Phân tích"** (`analyzeWithMapping` → `loadValues` → `applyAnalysis`) thì cards mới được tính lại.

So với **Excel** (`import-wizard.tsx`): `summary` là `useMemo([sheet, frontColumn, backColumn])` → đổi cột tự tính lại ngay, preview live-update. → Google Sheets phải hành xử tương tự.

## 2. Yêu cầu sửa

Sửa `src/features/imports/components/google-sheets-import.tsx` sao cho: **sau khi đã load/analyze xong, đổi Mặt trước/Mặt sau → preview cập nhật ngay theo cặp cột mới, không cần bấm lại "Phân tích".**

Cách làm (chọn 1 trong 2, ưu tiên cái sạch nhất):

### Phương án A — Re-run analysis khi đổi cột (đơn giản, an toàn)

- `onChange` của 2 dropdown: set state cột mới rồi **gọi lại `analyzeWithMapping()`** (debounce ~250ms nếu cần, theo pattern `match-setup`/`quiz-setup` dùng `COUNT_DEBOUNCE_MS`).
- Đảm bảo không gọi khi đang pending / khi `frontColumn === backColumn` (đã có guard).
- Kết quả: preview + số thẻ hợp lệ cập nhật theo cặp cột mới.

### Phương án B — Tính lại client-side từ dữ liệu đã tải (nhanh, không gọi API)

- Lưu raw rows đã tải (từ `applyAnalysis`) vào state.
- Khi đổi cột: dùng `applyMapping`/`adaptSheetData` + `validateDraftCards` tính lại cards ngay tại client (không fetch lại).
- Chú ý: `loadValues` hiện chỉ fetch đúng 2 cột đã chọn (`fetchColumnBodies` với `columns`) → nếu đổi sang cột khác chưa từng fetch thì phải fetch lại. Nếu chọn phương án này, phải đảm bảo fetch đủ dữ liệu cho mọi cột meaningful (rà `fetchPublicSheetValues`/`loadPrivateSheetValues` — hiện giới hạn `columns.length > 2`).

**Khuyến nghị: Phương án A** — ít rủi ro, khớp hành vi hiện có của nút "Phân tích", không đổi server actions.

## 3. Phạm vi không được làm

- KHÔNG đổi `adaptSheetData`/`detectColumns`/`applyMapping`/server actions (trừ khi phương án B bắt buộc — nếu vậy dừng hỏi trước khi sửa server).
- KHÔNG đổi `CreateSummary`, `ImportWizard`, `PasteImport`, `DocumentImport`, `FileImport`, `ManualSetForm`.
- KHÔNG đổi luồng semantic (1 cột → AI).
- Ô nhập tên bộ: đã có `maxLength={SET_NAME_MAX_LENGTH}` (120) trong `create-summary.tsx` — xác nhận giữ nguyên (nếu thiếu ở chỗ nào thì báo trong report, không tự ý thêm ngoài phạm vi).

## 4. Verification

```bash
npm run check
```

- Unit/component test cho `google-sheets-import` nếu có sẵn — cập nhật/viết thêm nếu khả thi (component phụ thuộc gapi/next-script — nếu khó test thì chứng minh bằng lý luận + ghi rõ).
- E2E: `document-import` / `document-auto-detection` nếu chạm (chạy để chắc không regression).
- Xác nhận thủ công (mô tả trong report): load sheet 2 cột → Phân tích → preview đúng cột 1/cột 2 → đổi Mặt trước sang cột khác → preview + số thẻ đổi theo.

## 5. Commit

```bash
git add <các file thuộc task>
git commit -m "fix: live-update Google Sheets preview when columns change"
```

## 6. Evidence report

- Repository: start/final commit, push status.
- Phương án chọn (A/B), thay đổi chính xác, cách chống double-fire (pending guard).
- Test: `npm run check`, E2E liên quan.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities.
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
