# Task N16 — /study hiện số thẻ ngay như /quiz (bỏ "Đang tính thẻ…")

> **Status:** delivered
> **Loại:** UI + logic nhẹ (client component) + xóa dead code server action + cập nhật test
> **Mức độ:** Giao diện / Trung bình
> **Tier (model đề xuất):** DeepSeek Flash (free) — không chạm DB/security, 1 commit
> **Baseline commit:** `e536c78` (đã push, main đồng bộ origin/main)
> **Quy tắc:** KHÔNG đụng file ngoài danh sách ở mục 3. Tạo đúng 1 commit. KHÔNG push — gửi evidence report.
> **Decisions locked:**
>
> 1. `/study` hiển thị số thẻ **ngay** = `totalCards` (khi "Tất cả") hoặc **tổng `cardCount` các nguồn đã chọn** (chưa dedup) — giống hệt `quiz-setup.tsx`.
> 2. Dedup thẻ vẫn được tính lại chính xác server-side ở `/study/mode` (không đổi).
> 3. Xóa dead code: `getStudyCardCount` + `StudyCountResult` + `studySourceSchema` + test tương ứng.
> 4. E2E `study-mode.spec.ts` cập nhật `"2 nguồn · 2 thẻ"` → `"2 nguồn · 3 thẻ"` (4 chỗ).
>    **Doc sync:** không bắt buộc (docs/ không commit trong repo này).

---

## 0. Bối cảnh

Yêu cầu gốc: "mục Học khi chọn 1 bộ thì hiện 'Đang tính thẻ…', mục Kiểm tra thì không — chuyển mục Học sang cơ chế giống mục Kiểm tra."

Hiện trạng:

- `/study` (`StudySourceSelect`) gọi server action `getStudyCardCount` (debounce 250ms) để tính số thẻ **dedup** cho phạm vi đã chọn; trong lúc chờ hiện "Đang tính thẻ…" và disable nút "Bắt đầu học".
- `/quiz` (`QuizSetup`) hiện số thẻ ngay: `all ? totalCards : sum(cardCount từng nguồn)`, không gọi server, dedup hoãn sang `/quiz/mode` (refactor `50237be`, comment ở `quiz-setup.tsx:39-41`).

Mục tiêu: làm cho `StudySourceSelect` hoạt động như `QuizSetup` — hiện số thẻ ngay, không còn trạng thái "Đang tính thẻ…", nút "Bắt đầu học" bấm được ngay.

## 1. Hiện trạng (file:line)

### 1.1 `src/features/study/components/study-source-select.tsx`

- Import `getStudyCardCount` ở dòng 12.
- `COUNT_DEBOUNCE_MS = 250` ở dòng 14.
- State `customCount` (dòng 49-52), `actionError` (dòng 53).
- `useEffect` debounce fetch count (dòng 89-104).
- `isCounting` (dòng 106-107), `availableCards` (dòng 108), `canStart` (dòng 109).
- `start()` custom path: gọi lại `getStudyCardCount` để re-check (dòng 140-155).
- `StickyStartBar` summary có nhánh `isCounting ? "Đang tính thẻ…" : ...` (dòng 195-201); `pending={isStarting}` (dòng 203).

Tham chiếu mẫu cần mirror: `src/features/quiz/components/quiz-setup.tsx:39-107` — `total = all ? totalCards : selectedSources.reduce((sum, s) => sum + (s.cardCount ?? 0), 0)`; `canStart = total >= 1 && (all || setIds.length + collectionIds.length > 0)`; `start()` navigate thẳng; `StickyStartBar` với `pending={false}`.

### 1.2 `src/features/study/server/actions.ts`

- `getStudyCardCount` (dòng 23-38) + type `StudyCountResult` (dòng 10) + `firstIssueMessage` (dòng 12-14) + import `studySourceSchema`, `collectStudyCardIds`, `ZodError`.
- Giữ nguyên: `completeStudySession`, `CompleteStudyResult`, `hasAuthenticatedSession`, import `recordDailyActivity`, `createClient`.

### 1.3 `src/features/study/schemas/study-schema.ts`

- `studySourceSchema` (dòng 12-26) chỉ được dùng bởi `getStudyCardCount` → xóa.
- Giữ nguyên: `idListSchema`, `seedSchema`, `extractIdList`, `parseStudySessionParams`, các import `z`, `STUDY_MAX_SOURCES`, type `StudySessionParams`.

### 1.4 Test liên quan

- `tests/unit/features/study/study-source-select.test.tsx` — mock `getStudyCardCount` (dòng 6-19), 5 test mô tả hành vi đếm/loading (dòng 66-82, 84-97, 99-112, 155-170, 172-186), 2 test phụ thuộc luồng chờ count (dòng 114-128, 130-139).
- `tests/unit/features/study/study-schema.test.ts` — block `describe("studySourceSchema", ...)` (dòng 17-50).
- `tests/e2e/study-mode.spec.ts` — 4 chỗ assert `"2 nguồn · 2 thẻ"` ở dòng **43, 103, 188, 282** (đều là chọn Bộ A + Bộ đặc biệt "Khó nhớ"); test dòng 34 tên "selection shows a deduplicated unique count".

Lưu ý fixture E2E: Set A có **2 thẻ** (set-management.csv: Xin chào/Hello, Cảm ơn/Thanks), bộ đặc biệt "Khó nhớ" chứa **1 thẻ** (Xin chào, trùng thẻ trong Set A). Sau đổi: hiển thị = `2 + 1 = 3` → `"2 nguồn · 3 thẻ"`. Số thẻ trong session lật thẻ vẫn là **2** (dedup ở `/study/mode`) — các assert `"1 / 2"`/`"2 / 2"`/`aria-valuemax="2"`/`"Tất cả 4 thẻ"` **giữ nguyên**.

## 2. Yêu cầu chi tiết

### 2.1 `study-source-select.tsx` — đổi sang cơ chế hiện ngay (mirror `quiz-setup.tsx`)

- Bỏ: import `getStudyCardCount`, `COUNT_DEBOUNCE_MS`, state `customCount` + `actionError`, `useEffect` debounce (bỏ luôn `useEffect` khỏi import `react` nếu không còn dùng), `isCounting`, `useTransition`/`isStarting`.
- Thêm biến dẫn xuất:
  ```tsx
  const total = all ? totalCards : selectedSources.reduce((sum, s) => sum + (s.cardCount ?? 0), 0);
  const canStart = total >= 1 && (all || selectedSources.length > 0);
  ```
- `start()` trở thành đồng bộ, navigate thẳng:
  - `all`: nếu `!totalCards` → `setError("Chưa có thẻ nào để học.")`; ngược lại `router.push("/study/mode?all=1")`.
  - custom: dựng query `sets`/`collections` từ `currentSources` rồi `router.push(\`/study/mode?${query}\`)`— **không** gọi count, **không** check`count > 0` trước khi điều hướng.
- `StickyStartBar`:
  ```tsx
  summary={all ? `${total} thẻ` : `${selectedSources.length} nguồn · ${total} thẻ`}
  canStart={canStart}
  pending={false}
  pendingLabel="Đang tải…"
  startLabel="Bắt đầu học"
  onStart={start}
  ```
- Giữ nguyên: `initialSource` restoration, empty state (`!totalCards`), `error` cho "Chưa có thẻ nào...", `SourceBrowser` props, `toggleSource`/`selectAll` (bỏ `setActionError(null)`).
- Xóa hẳn chuỗi `"Đang tính thẻ…"` khỏi file.

### 2.2 `study/server/actions.ts` — xóa dead code

- Xóa `getStudyCardCount`, `StudyCountResult`, `firstIssueMessage`, và import không còn dùng: `studySourceSchema`, `collectStudyCardIds`, `ZodError`.
- Giữ `completeStudySession` + `hasAuthenticatedSession` + các import còn dùng.

### 2.3 `study/schemas/study-schema.ts` — xóa `studySourceSchema`

- Xóa export `studySourceSchema` (dòng 12-26). Giữ mọi thứ khác nguyên vẹn. Không xóa `idListSchema`/`seedSchema` vì `parseStudySessionParams` vẫn dùng.

### 2.4 `tests/unit/features/study/study-source-select.test.tsx` — cập nhật theo hành vi mới

- Bỏ mock `@/features/study/server/actions` (dòng 17-19) và `mocks.getStudyCardCount` (dòng 7, 35-37) — component không còn import module đó.
- **Xóa** (hành vi không còn): test "shows a loading state while the unique count is being computed" (66-82), "fetches a deduplicated count when a set is selected" (84-97), "combines sets and collections into a unique count" (99-112), "re-checks the count on start and shows an error when the selection is empty" (155-170), "shows a recoverable error when the count action fails" (172-186).
- **Cập nhật**:
  - "shows zero and disables start when the selection is emptied" (114-128): vẫn chờ `"0 nguồn · 0 thẻ"` + disabled — nhưng bỏ phần phụ thuộc `getStudyCardCount.mockImplementation`; assert ngay (không cần chờ action).
  - "starts a custom session and redirects with the chosen source ids" (130-139): bỏ `waitFor` chờ count; click → `mocks.push` được gọi ngay với `/study/mode?sets=...`.
- **Thêm test mới** (bù cho test đã xóa, phải làm số test tăng so với baseline cũ 12):
  - Chọn Set A (cardCount 2) + Bộ "Khó nhớ" (cardCount 1) → hiện `"2 nguồn · 3 thẻ"` **ngay lập tức** (không cần chờ, không gọi server).
  - Sau khi chọn nguồn: **không bao giờ** xuất hiện `"Đang tính thẻ…"` và nút "Bắt đầu học" **không bị disable** vì lý do đang tính (assert nút enabled ngay sau khi chọn).
  - Bấm "Bắt đầu học" khi đang chọn nguồn → push `/study/mode?sets=...&collections=...` (nếu test này chưa được phủ).
- Giữ nguyên các test còn lại: default all, start all, disabled khi 0 thẻ, restore initialSource, empty state.

### 2.5 `tests/unit/features/study/study-schema.test.ts`

- Bỏ `describe("studySourceSchema", ...)` (dòng 17-50) và bỏ `studySourceSchema` khỏi import. Giữ nguyên test `parseStudySessionParams`.

### 2.6 `tests/e2e/study-mode.spec.ts`

- Đổi **4 chỗ** `"2 nguồn · 2 thẻ"` → `"2 nguồn · 3 thẻ"` (dòng 43, 103, 188, 282). Kiểm tra từng chỗ vẫn đúng ngữ cảnh chọn Bộ A + "Khó nhớ" trước khi assert.
- Đổi tên test dòng 34 thành `"selection shows an immediate count from source card counts"` (không còn dedup ở đây).
- **KHÔNG** đổi các assert `"1 / 2"`, `"2 / 2"`, `aria-valuemax="2"`, `"Tất cả 4 thẻ"`, `aria-valuemax="4"` — số thẻ session vẫn dedup ở `/study/mode`.

## 3. Phạm vi KHÔNG được làm

- **KHÔNG** đổi `/study/mode`, `/study/session`, `load-study-cards.ts`, `study-mode-select.tsx`, `study-session.tsx`, `merge-cards.ts`.
- **KHÔNG** đổi `quiz-setup.tsx` hay bất kỳ file feature quiz nào.
- **KHÔNG** đổi các màn `/memory`, `/runner`, `/match` (chuỗi "Đang tính thẻ…" ở `memory-setup.tsx`, `runner-setup.tsx`, `match-setup.tsx` giữ nguyên — chúng đối xứng với phía quiz).
- **KHÔNG** có migration, KHÔNG đổi DB, KHÔNG đổi env.
- **KHÔNG** sửa các test để che lỗi — chỉ cập nhật đúng theo hành vi mới đã chốt.

## 4. Verification (bắt buộc chạy)

```bash
npm run lint
npm run typecheck
npm run test                 # vitest run — test liên quan phải PASS, tổng số test tăng/không giảm
npm run build
```

E2E (cần Supabase local + dev server, chạy qua script chuẩn của repo):

```bash
npm run test:e2e -- tests/e2e/study-mode.spec.ts
```

- Nếu E2E không chạy được vì môi trường local (Supabase/port) → ghi rõ "chưa chạy được, tin theo phân tích" trong evidence report, KHÔNG được giả vờ đã chạy.

Check tổng hợp (nếu giữ được trong thời gian cho phép):

```bash
npm run check
```

## 5. Commit

Tạo đúng **1 commit**:

```
feat: show study card count immediately like quiz setup
```

KHÔNG push.

## 6. Evidence report (format bắt buộc)

- **Repository:** start commit `e536c78`, final commit hash, push status (KHÔNG push).
- **Bảng thay đổi từng mục** (file → trước → sau), kèm trích code ngắn:
  - `study-source-select.tsx`: khối `total`/`canStart`/`start()` mới + `StickyStartBar`.
  - `actions.ts`: các export đã xóa (liệt kê tên).
  - `study-schema.ts`: xác nhận `studySourceSchema` không còn, `parseStudySessionParams` giữ nguyên.
  - Unit test: số test trước (12) / sau, liệt kê test xóa + test thêm.
  - E2E: 4 dòng đổi `"2 nguồn · 3 thẻ"` + tên test mới.
- **Test đã chạy + kết quả:** lint / typecheck / vitest (số file + số test pass) / build / E2E (nếu chạy được).
- **Safety checklist:** migrations=NO, DB=NO, deps=NO, env=NO, production=NO.
- **Ambiguities:** điểm tự quyết + lý do (nếu có).
- **Verdict:** `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
