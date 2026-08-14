# CapyStudy — Task 2: trang Bộ flashcard — 2 thẻ lớn + bỏ review khi tạo

> **Status:** delivered (2026-08-14)
> **Baseline commit:** commit của Task 1 (sort + wrong definition) trên main — hoặc mới nhất nếu có task khác merged (lấy commit mới nhất trên main)
> **Agent tier:** Codex + GPT-5.6 Terra — **không cần review riêng** (thuần UI, không chạm DB/security; tuy nhiên nếu phát hiện cần đổi schema → STOP hỏi user)
> **Decisions locked (user):**
>
> - Trang `/sets` hiển thị **2 thẻ lớn** (kích thước vừa 1 màn mobile mỗi thẻ):
>   1. **"point-right + Tạo Flash card"** — mở ra có **1 thẻ mặc định là giao diện Dán nội dung**, bên dưới là các lựa chọn nhỏ: Google Sheets / Tài liệu (excel, word, pdf — hệ thống tự nhận diện loại file) / Thủ công.
>   2. **"normal + Flash card của bạn"** — chứa danh sách **cả bộ thường lẫn bộ đặc biệt** (bên trong thẻ vẫn giữ 2 nhóm: Bộ thường / Bộ đặc biệt, hiển thị theo thứ tự thời gian đã có từ Task 1).
> - **Bỏ phần review khi tạo**: chọn nguồn → **chỉ nhập tên bộ → tạo flashcard luôn** (không qua màn hình sửa/sắp xếp từng thẻ). Người dùng vẫn sửa/xóa thẻ sau đó trong trang chi tiết bộ.
> - Nút "Sắp xếp" (kéo thả) giữ nguyên trong khu vực "Flash card của bạn".
>   **Ngoài phạm vi:** trang Học/Kiểm tra (Task 3/4), thoát/pause (Task 5), match/study/header (Task 6), thứ tự/câu sai (Task 1 — đã có).

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Đọc trước:

- `src/app/(app)/sets/page.tsx` — toàn bộ trang hiện tại (CreateSetBlock + SectionTabs Bộ thường/Bộ đặc biệt + SetsTabContent)
- `src/features/flashcard-sets/components/sets-list.tsx`, `src/features/special-collections/components/collections-list.tsx`
- `src/features/imports/components/paste-import.tsx`, `import-wizard.tsx`, `google-sheets-import.tsx`, `document-import.tsx`, `manual-set-form.tsx`
- `src/features/imports/components/unified-draft-editor.tsx` (hiện là bước sửa trước khi tạo)
- `src/features/imports/server/actions.ts` (`importFlashcards`) — contract tạo bộ
- `src/features/mascot/components/mascot-image.tsx` (dùng mascot point-right/normal)

---

## 1. Bố cục trang /sets mới

### 1.1 Hai thẻ lớn

Thay cụm `CreateSetBlock` hiện tại (5 nút nhỏ) bằng **2 thẻ lớn**, mỗi thẻ ~kích thước 1 màn mobile (cao, dễ chạm, mobile-first; trên desktop hiển thị 2 cột):

**Thẻ 1 — "Tạo Flash card"** (mascot `point-right`, kích thước phù hợp — tham khảo dashboard motivation bar):

- Nhấn vào → mở trạng thái tạo bộ.
- Mặc định hiện **giao diện Dán nội dung** (textarea paste + nút Phân tích) như `PasteImport` hiện tại.
- Bên dưới: hàng lựa chọn nhỏ (không phải thẻ to):
  - Google Sheets
  - Tài liệu (nhận diện file: excel `.xlsx`/`.csv`, word `.docx`, pdf `.pdf` — chọn file, hệ thống tự dùng parser phù hợp)
  - Thủ công
- Các lựa chọn này chuyển đổi nội dung bên trong thẻ (không cần URL param nếu dùng state local; tuy nhiên nếu giữ pattern URL `?create=` hiện tại thì đảm bảo deep-link vẫn hoạt động — chọn cách đơn giản nhất, ưu tiên giữ URL param vì hiện có `?create=import` được link từ các nơi khác: study empty state dùng `/sets?create=import`).

**Thẻ 2 — "Flash card của bạn"** (mascot `normal`):

- Mở ra hiển thị danh sách bộ của user: **Bộ thường + Bộ đặc biệt**.
- Bên trong giữ 2 nhóm/tab con (Bộ thường / Bộ đặc biệt) — kế thừa `SectionTabs` hiện tại + `SetsTabContent` (bộ thường order `created_at desc` từ Task 1, bộ đặc biệt như cũ).
- Nút "Sắp xếp" giữ nguyên trong nhóm Bộ thường.
- Tìm kiếm giữ nguyên.

### 1.2 Cấu trúc tương tác

- Ban đầu trang hiển thị **cả 2 thẻ lớn** cạnh nhau (mobile: dọc; desktop: 2 cột).
- Mỗi thẻ bấm vào → expand nội dung tương ứng bên trong (accordion/card mở) — **không** chuyển hẳn sang trang khác; người dùng có thể đóng lại để chọn thẻ kia.
- Giữ heading "Bộ flashcard" + breadcrumb/nav hiện tại.

---

## 2. Bỏ review — tạo flashcard luôn

### 2.1 Nguyên tắc

Sau khi người dùng cung cấp nội dung (dán/xuất excel/word/pdf/google sheets/thủ công), hệ thống:

1. Parse/normalize thành danh sách thẻ (front/back) — **giữ nguyên logic parse hiện có** (`parseWorkbook`, `sheetToDraftCards`, `analyzePasteContent`, document extractor).
2. Hiển thị **tóm tắt nhanh** (số thẻ hợp lệ, số thẻ trống/thiếu/trùng nếu có — chỉ thông báo, KHÔNG cho sửa từng thẻ ở bước này).
3. **Nhập tên bộ** (bắt buộc, giống contract hiện tại của `importFlashcards`).
4. Nút **"Tạo bộ flashcard"** → gọi action import hiện có → redirect tới `/sets/[setId]` (như `UnifiedDraftEditor.handleImport` hiện làm).

### 2.2 Xử lý thẻ không hợp lệ

- Thẻ thiếu front/back: **bỏ qua + thông báo số lượng** (giữ nguyên quy tắc validation hiện có trong `validateDraftCards` — nhưng KHÔNG mở editor để sửa).
- Thẻ trùng chính xác sau trim: bỏ bản trùng + thông báo số lượng (quy tắc hiện có).
- Nếu **không còn thẻ hợp lệ nào** → báo lỗi rõ, không cho tạo.
- Nếu `limitExceeded` (quá `IMPORT_MAX_ROWS`) → báo lỗi như hiện tại, không tạo.

### 2.3 UnifiedDraftEditor

- Không render `UnifiedDraftEditor` (màn sửa từng thẻ) trong luồng tạo mới này.
- **Giữ nguyên file** `unified-draft-editor.tsx` nếu còn nơi khác dùng (kiểm tra: ai đang dùng nó — paste/import-wizard/document/google-sheets). Nếu sau khi bỏ review, nó không còn được dùng ở đâu → vẫn KHÔNG xóa file trong task này (tránh phá luồng khác chưa kiểm tra kỹ); báo trong evidence nếu phát hiện dead code.
- Có thể tạo 1 component nhỏ mới (vd `QuickCreateResult` / `CreateSummary`) hiển thị tóm tắt + tên bộ + nút tạo — thay cho editor.

### 2.4 Contract import giữ nguyên

- Không đổi schema server action `importFlashcards` (name + cards). Chỉ đổi UI phía trước.

---

## 3. Mobile-first

- 2 thẻ lớn: mobile xếp dọc, mỗi thẻ chiếm gần hết chiều rộng + đủ cao để chạm dễ; desktop 2 cột.
- Các lựa chọn nhỏ (Google Sheets/Tài liệu/Thủ công) là chips/nút nhỏ dưới paste area — không chiếm quá nhiều diện tích.
- Không horizontal overflow ở 390px (thêm assert E2E nếu có sẵn pattern).

---

## 4. Tests

### 4.1 Unit/component

- Component test cho thẻ "Tạo Flash card": mở mặc định là Dán nội dung; chuyển đổi được giữa các nguồn.
- Component test cho "Flash card của bạn": hiển thị cả 2 nhóm; nút Sắp xếp vẫn còn.
- Nếu có test cũ assert cụm 5 nút cũ → cập nhật.

### 4.2 E2E

- `tests/e2e/set-management.spec.ts` (nếu có) + spec import: cập nhật selector theo UI mới.
- Assert: tạo bộ qua Dán nội dung → chỉ nhập tên → tạo → redirect tới trang bộ (không qua màn sửa thẻ).
- Assert không overflow 390px trên /sets.

---

## 5. Verification

```bash
npm run check
npm run test:e2e -- set-management import  # nếu suite có
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff: không đụng engine/quiz/study/memory/runner logic, không migration, không đổi server action contract.

## 6. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: redesign flashcard library with create cards and instant import"
```

**Không push** — chờ xác nhận của điều phối (không cần Sol review nếu không chạm DB; nếu phát hiện cần DB → dừng hỏi).

## 7. Evidence report

- Repository: starting/final commit, push status, worktree
- Bố cục mới: mô tả 2 thẻ + cách chuyển nguồn
- Bỏ review: luồng tạo mới từng bước + xử lý thẻ không hợp lệ
- Files changed
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
