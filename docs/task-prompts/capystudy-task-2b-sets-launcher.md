# CapyStudy — Task 2b: /sets thành launcher 2 thẻ + trang riêng /sets/create và /sets/library

> **Status:** delivered (2026-08-14)
> **Baseline commit:** `8074b8c` (trên origin/main — sau Task 2, Task 6a/b/c)
> **Agent tier:** DeepSeek V4 Flash Free (đã quen code Task 2) — thuần UI/routing, không chạm DB; không cần review riêng nhưng E2E bắt buộc
> **Quyết định đã chốt (user):**
>
> - `/sets` ban đầu **CHỈ hiển thị 2 thẻ điều hướng LỚN** (mỗi thẻ ~1 màn mobile, xếp dọc trên mobile), **không hiển thị chips/forms/danh sách gì trên trang này**:
>   1. **point-right + "Tạo Flash card"** → click → điều hướng `/sets/create`
>   2. **normal + "Flash card của bạn"** → click → điều hướng `/sets/library`
> - `/sets/create` — trang tạo: **mặc định hiển thị giao diện Dán nội dung**, bên dưới là **các lựa chọn nhỏ** (chips): Google Sheets / Tài liệu (excel, word, pdf — tự nhận diện) / Thủ công. Chọn nguồn → đặt tên bộ → **tạo luôn** (KHÔNG qua màn review — giữ nguyên `CreateSummary` đã có từ Task 2).
> - `/sets/library` — thư viện hiện tại (tabs Bộ thường/Bộ đặc biệt + tìm kiếm + Sắp xếp + phân trang) — **dời nguyên xi từ /sets sang đây**.
> - Deep-link cũ phải được xử lý (redirect hoặc giữ hoạt động) — không được 404.
>   **Ngoài phạm vi:** /study (Task 3), /quiz (Task 4), thoát/pause (Task 5), mọi thứ đã push khác.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -5 --oneline
git pull --ff-only
```

Đọc trước (bắt buộc):

- `src/app/(app)/sets/page.tsx` — hiện là launcher inline (CreateSetCard + LibraryCard cạnh nhau, mở sẵn chi tiết) → **viết lại** thành launcher 2 thẻ điều hướng
- `src/features/flashcard-sets/components/create-set-card.tsx` — chuyển thành **trang** `/sets/create` (giữ chips, bỏ cơ chế inline `?create=`)
- `src/features/flashcard-sets/components/library-card.tsx` — bỏ (thư viện dời hẳn sang /sets/library)
- `src/app/(app)/import/page.tsx` — hiện `redirect("/sets?create=import")` → sửa redirect
- `src/app/(app)/dashboard/page.tsx` (dòng 78–79) — redirect `?create=import|manual` → sửa
- `src/features/imports/components/paste-import.tsx`, `google-sheets-import.tsx`, `document-import.tsx`, `import-wizard.tsx`, `file-import.tsx`, `create-summary.tsx` — các source UI (tái sử dụng nguyên vẹn, không đổi logic)
- `src/features/flashcard-sets/components/manual-set-form.tsx` — source Thủ công
- `src/lib/pagination.ts` — `updateSearchParamHref`/`removeSearchParamHref` helpers
- Tests liên quan: `tests/e2e/*` nhắc `/sets?create=...` hoặc `/import`

---

## 1. Trang `/sets` — launcher 2 thẻ

- Xóa toàn bộ nội dung cũ (CreateSetCard inline + LibraryCard + chips + tabs).
- Trang chỉ còn: heading "Bộ flashcard" + **2 thẻ điều hướng lớn**, xếp dọc trên mobile (mỗi thẻ cao ~1 màn mobile, `min-h-[calc(100dvh-<header>)]` tương đương), desktop có thể 2 cột.
- Thẻ 1: mascot `point-right` + "Tạo Flash card" + mô tả ngắn ("Biến nội dung thành thẻ học") → `Link href="/sets/create"`.
- Thẻ 2: mascot `normal` + "Flash card của bạn" + mô tả ("Bộ thường và bộ đặc biệt") → `Link href="/sets/library"`.
- Có thể tái sử dụng style thẻ từ `create-set-card.tsx`/`library-card.tsx` cũ (rounded, border, bg, mascot layout) — chỉ bỏ phần chi tiết.
- Nếu `/sets` còn nhận `?create=`, `?tab=`, `?reorder=`, `?q=`, `?page=` → **redirect sang route mới** (xem §3). Nếu không có param → render launcher.

## 2. Trang `/sets/create`

- Route mới `src/app/(app)/sets/create/page.tsx` (server page; `metadata.title = "Tạo Flash card"`).
- Layout: heading "Tạo Flash card" + nút/link "← Bộ flashcard" (về `/sets`).
- **Mặc định hiển thị giao diện Dán nội dung** (`<PasteImport />`).
- Bên dưới là **hàng chips nhỏ** (giống SOURCE_CHIPS cũ): Google Sheets / Tài liệu / Thủ công — click đổi nguồn (state local hoặc search param `?source=`, chọn cách đơn giản nhất; nếu dùng param thì `?source=paste|google_sheets|file|manual`, mặc định `paste`).
- Nguồn render:
  - `paste` → `<PasteImport />` (mặc định)
  - `google_sheets` → `<GoogleSheetsImport />`
  - `file` → `<FileImport />` (Tài liệu: excel/word/pdf tự nhận diện)
  - `manual` → `<ManualSetForm />`
- Tất cả nguồn giữ nguyên logic Task 2: parse → `CreateSummary` (đặt tên bộ → "Tạo bộ flashcard" → tạo luôn, không review).
- Thẻ chip active dùng `aria-current` (như cũ).

## 3. Trang `/sets/library`

- Route mới `src/app/(app)/sets/library/page.tsx` — **dời nguyên xi** toàn bộ phần thư viện hiện tại của `/sets` (tabs Bộ thường/Bộ đặc biệt + tìm kiếm + Sắp xếp + phân trang + `SetsTabContent` + reorder) sang đây, giữ đúng mọi hành vi và thứ tự `created_at desc` (Task 1).
- Heading "Flash card của bạn" + link "← Bộ flashcard" (về `/sets`).
- Giữ nguyên params: `?tab=regular|special`, `?q=`, `?page=`, `?reorder=1`.

## 4. Redirect deep-link cũ (BẮT BUỘC — không được 404)

- `/import` (page cũ) → `redirect("/sets/create")` (hoặc `/sets/create?source=file` — chọn: mặc định paste là đúng yêu cầu "mặc định Dán nội dung", nên `/import` → `/sets/create`).
- `/sets?create=import` hoặc `?create=document` → `redirect("/sets/create?source=file")`.
- `/sets?create=paste` → `redirect("/sets/create")` (mặc định).
- `/sets?create=google_sheets` → `redirect("/sets/create?source=google_sheets")`.
- `/sets?create=manual` → `redirect("/sets/create?source=manual")`.
- `/sets?tab=...`, `?reorder=1`, `?q=`, `?page=` (không có `create`) → `redirect("/sets/library?" + params giữ nguyên)`.
- `/dashboard?create=import` → `/sets/create?source=file`; `/dashboard?create=manual` → `/sets/create?source=manual` (dòng 78–79 dashboard).
- Thực hiện redirect ở server (page redirect) — không redirect phía client nếu tránh được.

## 5. Cập nhật tests + links

- Grep toàn repo `grep -rn "create=import\|create=document\|create=paste\|create=manual\|create=google_sheets\|/sets?tab\|/import" src/ tests/` — cập nhật mọi link/assertion:
  - Link nhảy thẳng tới source cũ → trỏ `/sets/create?source=...` hoặc `/sets/create`.
  - Assertion E2E về /sets cũ (tabs, tìm kiếm, reorder, phân trang) → chuyển sang `/sets/library`.
  - Assertion "/sets?create=import" mở file import → `/sets/create?source=file`.
- Cập nhật `tests/unit/features/flashcard-sets/library-cards.test.tsx`, `tests/unit/features/imports/*` nếu chúng test cấu trúc /sets cũ.
- Thêm E2E (hoặc cập nhật spec hiện có):
  - `/sets` hiển thị đúng 2 thẻ, KHÔNG hiển thị chips/danh sách.
  - Click "Tạo Flash card" → `/sets/create` với Dán nội dung hiển thị mặc định; click chip "Tài liệu" → file import hiển thị.
  - Click "Flash card của bạn" → `/sets/library` có tabs.
  - `/import` redirect sang `/sets/create` không 404.
  - `/sets?tab=special` redirect `/sets/library?tab=special`.
  - Không horizontal overflow 390px trên cả 3 trang.

## 6. Mobile-first

- Launcher: 2 thẻ dọc, mỗi thẻ ~1 màn mobile (`min-h` dvh), không overflow 390px.
- /sets/create: chips nhỏ gói gọn, form nguồn đã mobile-friendly sẵn.
- /sets/library: giữ nguyên bố cục hiện tại.

## 7. Verification

```bash
npm run check
npm run test:e2e -- primary-navigation paste-import document-import document-auto-detection unified-editor mobile-first-ui
# + nếu có spec /sets/library hoặc flashcard-set-ordering
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff: không migration/DB/deps/env/AI; không đụng /study /quiz /match /memory /runner; không xóa route /sets (vẫn là launcher).

## 8. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: turn sets page into launcher with dedicated create and library routes"
```

**Không push** — gửi evidence report cho điều phối.

## 9. Evidence report

- Repository: starting/final commit, push status, worktree
- Sơ đồ route mới: /sets → /sets/create (4 source) + /sets/library; bảng redirect deep-link cũ → mới
- Files changed
- Tests: files/discovered/passed/failed/skipped (kể cả E2E)
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`

---

## Ràng buộc tuyệt đối

1. KHÔNG đổi logic import/tạo bộ (CreateSummary + source UIs giữ nguyên) — chỉ tái cấu trúc route/layout.
2. KHÔNG xóa khả năng truy cập thư viện cũ (tabs/search/reorder/phân trang) — dời nguyên sang /sets/library.
3. Mọi deep-link cũ phải đi đâu đó hợp lý — không 404, không để link chết.
4. Nếu phát hiện cần đổi DB/schema → STOP hỏi user.
