# CapyStudy — Task 8b: Nút trở về đồng nhất `← Thoát` + điều hướng về đường dẫn trước đó

> **Loại:** UI consistency — nhiều file nhưng cơ học, lặp lại.
> **Tier:** Codex + Terra (chạm nhiều trang) — không cần Sol review (thuần UI/navigation, không DB).
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7, Task 8a đã push).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. Một commit duy nhất. KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh

User yêu cầu:

> "mọi nút trở về đều sử dụng: `<a class="text-sm underline" href="">← Thoát</a>` (tương tự đồng nhất với nhau ở mọi nơi và giống /sets/*). mọi nút trở về điều hướng về đường dẫn ngay trước đó (kiểm tra kĩ phần này ở mọi trang, nhiều nút trở về, thoát đang có định đường dẫn chứ không trở về đường dẫn ngay trước đó)."

**Hai yêu cầu:**

1. **Style đồng nhất:** mọi nút trở về = text link `← Thoát` (class `text-sm underline`), giống `/sets/create` và `/sets/library` hiện tại (đã dùng `<Link className="text-sm underline" href="/sets">← Bộ flashcard</Link>`).
2. **Điều hướng về đường dẫn NGAY TRƯỚC ĐÓ** (history back) — không hardcode đường dẫn. Hiện nhiều nút đang hardcode (vd `/sets/[setId]` → `/sets`, match-session → `/study`) — phải đổi thành quay về trang trước.

## 1. Component dùng chung mới

Tạo **một** component dùng chung để đồng nhất (tên gợi ý: `src/components/shared/exit-link.tsx` hoặc sửa `back-button.tsx` — chọn 1, không tạo trùng):

```tsx
"use client";
// Render: <a class="text-sm underline" href="javascript:void(0)">← Thoát</a>
// onClick → router.back() nếu có history, ngược lại router.push(fallbackHref)
// (tái sử dụng useBackWithFallback nếu hợp lý)
```

API nhỏ: `{ fallbackHref: string; className?: string; label?: string }`, mặc định label `"← Thoát"`.

**Lưu ý:** đây là nút điều hướng → dùng `<a>` hoặc `<button>` với `type="button"` + `aria-label` phù hợp; KHÔNG dùng `<Link>` vì cần `router.back()` động. Giữ focus-visible + touch target ≥ 44px (padding hợp lý).

## 2. Danh sách nút trở về cần sửa (rà lại bằng grep trước khi làm)

```bash
grep -rn "Quay lại\|← \|BackButton\|SessionExitButton" src/app src/features --include="*.tsx" | grep -v test
```

| #   | File                                                             | Hiện tại                                                                                 | Thay bằng                                                                         |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `src/app/(app)/sets/[setId]/page.tsx:112`                        | `<Link href="/sets">← Tất cả bộ flashcard</Link>` (hardcode /sets)                       | `← Thoát` → back, fallback `/sets/library?tab=regular`                            |
| 2   | `src/app/(app)/collections/[collectionId]/page.tsx:78`           | `<Link href="/collections">← Tất cả bộ đặc biệt</Link>` (hardcode /collections)          | `← Thoát` → back, fallback `/sets/library?tab=special`                            |
| 3   | `src/app/(app)/sets/create/page.tsx`                             | `<Link ...>← Bộ flashcard</Link>` (hardcode /sets)                                       | `← Thoát` → back, fallback `/sets`                                                |
| 4   | `src/app/(app)/sets/library/page.tsx`                            | `<Link ...>← Bộ flashcard</Link>` (hardcode /sets)                                       | `← Thoát` → back, fallback `/sets`                                                |
| 5   | `src/features/study/components/study-mode-select.tsx:121`        | `<BackButton fallbackHref="/study?..." label="Quay lại chọn nguồn">`                     | `← Thoát` → back, fallback `/study?<params>`                                      |
| 6   | `src/features/quiz/components/quiz-mode-select.tsx:106`          | `<BackButton fallbackHref={backHref} label="Quay lại chọn nguồn">`                       | `← Thoát` → back, fallback `backHref`                                             |
| 7   | `src/features/learning-modes/components/session-exit-button.tsx` | icon button ChevronLeft size-11                                                          | đổi render thành `← Thoát` text link (GIỮ nguyên dialog xác nhận — Task 5 đã làm) |
| 8   | `src/features/runner/components/runner-hud.tsx:24-33`            | icon button "Quay lại" (ChevronLeft, size-11)                                            | `← Thoát` text link (giữ onBack → dialog xác nhận)                                |
| 9   | `src/features/match/components/match-session.tsx:99,127,147`     | `<Link href="/study">Quay lại</Link>` (hardcode /study — SAI)                            | `← Thoát` → back, fallback `/quiz/mode`                                           |
| 10  | `src/features/memory/components/memory-session.tsx:113,142,162`  | `<Button onClick={goBack}>Quay lại</Button>` (đã back, chỉ đổi label/style)              | `← Thoát` text link                                                               |
| 11  | `src/features/runner/components/runner-end-overlay.tsx:90`       | `<Button onClick={onBack}>Quay lại</Button>` (đã back)                                   | `← Thoát` text link                                                               |
| 12  | `src/features/study/components/study-session.tsx`                | `SessionExitButton` (sẽ tự đổi theo #7) + nút "Hoàn thành" (không phải nút trở về — GIỮ) | chỉ cập nhật nếu cần                                                              |
| 13  | `src/features/quiz/components/quiz-session.tsx`                  | `SessionExitButton` (tự đổi theo #7)                                                     | —                                                                                 |

**Không sửa:**

- `src/app/check-email/page.tsx:33` `<Link href="/">Quay lại</Link>` — trang auth công khai, giữ nguyên (ngoài phạm vi "trong app").
- `card-collections-control.tsx:60` "Tạo bộ đặc biệt" — không phải nút trở về.
- Các `Button asChild` CTA chính (Bắt đầu / Chơi lại / Hoàn thành) — không phải nút trở về.

## 3. Chi tiết từng nhóm

### Nhóm A — Session exit (giữ dialog xác nhận)

`session-exit-button.tsx`: giữ nguyên logic dialog `ExitConfirmDialog` (Task 5), chỉ đổi phần render nút:

- Bỏ icon `ChevronLeft` size-11 → render `← Thoát` với class `text-sm underline` (padding đủ touch).
- `onConfirm={goBack}` giữ nguyên (đã dùng `useBackWithFallback` → back về đường dẫn trước đó).

### Nhóm B — Nút "Quay lại" hardcode → back thật

- `match-session.tsx`: 3 chỗ `<Link href="/study">Quay lại</Link>` — đổi thành nút `← Thoát` dùng `useBackWithFallback("/quiz/mode")` (fallback hợp lý vì match vào từ /quiz/mode).
- Kiểm tra thêm: các nút "Thử lại"/"Chơi lại" GIỮ nguyên (không phải nút trở về).

### Nhóm C — Các trang còn lại

Áp dụng component dùng chung (mục 1) cho #1–#6, #10, #11.

## 4. Lưu ý

- Mobile-first: text link vẫn phải đủ lớn để chạm (padding vertical ~12px hoặc min-height 44px).
- `aria-label` đầy đủ (vd `aria-label="Thoát"`) vì text đã hiển thị → aria-label tùy chọn nhưng nên có.
- Không đổi bất kỳ logic session/quiz/match/memory/runner nào khác.

## 5. Verification

```bash
npm run check
npm run test:e2e -- primary-navigation study-mode quiz-advancement match memory runner-setup
```

Xác nhận cuối:

- `grep -rn "Quay lại" src/ --include="*.tsx" | grep -v test` → chỉ còn các chỗ KHÔNG phải nút trở về (CTA, end overlay nếu giữ) — liệt kê trong report.
- Không còn `<Link href="/study">` hardcode ở match-session.
- Test E2E assert nút cũ (icon/`Quay lại chọn nguồn`) → cập nhật assert theo UI mới, KHÔNG xóa test.

## 6. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: unify back navigation as Thoát text links"
```

## 7. Evidence report

- Repository: start/final commit, push status.
- Bảng từng vị trí: file:line → trước → sau → fallback href.
- Component dùng chung mới: tên, API, cách dùng.
- Test: `npm run check`, E2E.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities.
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
