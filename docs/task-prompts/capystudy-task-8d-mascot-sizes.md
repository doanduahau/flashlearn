# CapyStudy — Task 8d: Mascot tối thiểu 64px + mascot thinking trong dialog thoát

> **Loại:** UI thương hiệu — nhẹ, cơ học.
> **Tier:** Gemini — không review riêng, E2E bắt buộc.
> **Baseline commit:** commit mới nhất trên main tại thời điểm giao (SAU Task 7, 8a–8c đã push — vì task này đụng nhiều file import/source đã bị Task 7 sửa).
> **Quy tắc:** KHÔNG đụng file ngoài danh sách. 1 commit duy nhất (hoặc 2 nếu tiện — ghi rõ). KHÔNG push — gửi evidence report.

---

## 0. Bối cảnh

User yêu cầu:

> "các mascot trạng thái ở tất cả mọi nơi kích thước tối thiểu phải là 64x64, không bé hơn, chỗ nào lớn hơn rồi thì để nguyên."
> "thông báo thoát có thêm mascot thinking."

**Quy tắc chung:** mọi `<MascotImage>` có kích thước < 64 → nâng lên **tối thiểu 64** (giữ tỷ lệ hiện tại: `size={64}` và `className` tương ứng, thường `size-12`→`size-16` hoặc `size-8`→`size-16`). Chỗ nào đã ≥ 64 → **GIỮ NGUYÊN**. Chỉ đổi `size` + `className` kích thước — KHÔNG đổi `level`, `state`, layout, alt, aria.

## 1. Rà toàn bộ vị trí bằng grep

```bash
grep -rn "MascotImage" src/ --include="*.tsx" -A 4 | grep -E "size=|className=\"size-"
```

Danh sách biết trước (rà lại vì Task 7 có thể đã đổi level, không đổi size):

| #   | File                                                               | size hiện tại                  | Đổi thành                             |
| --- | ------------------------------------------------------------------ | ------------------------------ | ------------------------------------- |
| 1   | `src/features/imports/components/paste-import.tsx`                 | 24 (`size-6`)                  | 64 (`size-16`)                        |
| 2   | `src/features/imports/components/google-sheets-import.tsx`         | 32 (`size-8`)                  | 64 (`size-16`)                        |
| 3   | `src/features/imports/components/document-import.tsx`              | 32 (`size-8`)                  | 64 (`size-16`)                        |
| 4   | `src/features/imports/components/import-wizard.tsx`                | 48 (`size-12`) + 32 (`size-8`) | 64 (`size-16`) ×2                     |
| 5   | `src/features/imports/components/file-import.tsx`                  | 48 (`size-12`)                 | 64 (`size-16`)                        |
| 6   | `src/features/imports/components/create-summary.tsx`               | 24 (`size-6`, nút Đang tạo)    | 64 (`size-16`)                        |
| 7   | `src/features/study/components/study-source-select.tsx`            | 48 (`size-12`)                 | 64 (`size-16`)                        |
| 8   | `src/features/source-selection/components/source-browser.tsx`      | 48 (`size-12`)                 | 64 (`size-16`)                        |
| 9   | `src/features/statistics/components/statistics-panel.tsx`          | 48 ×2 (`size-12`)              | 64 (`size-16`) ×2 (chỗ 64 giữ nguyên) |
| 10  | `src/features/flashcard-sets/components/sets-list.tsx`             | 48 (`size-12`)                 | 64 (`size-16`)                        |
| 11  | `src/features/special-collections/components/collections-list.tsx` | 48 (`size-12`)                 | 64 (`size-16`)                        |
| 12  | `src/features/flashcard-sets/components/set-reorder-list.tsx`      | 48 (`size-12`)                 | 64 (`size-16`)                        |
| 13  | `src/app/(app)/sets/[setId]/page.tsx`                              | 48 (`size-12`, empty state)    | 64 (`size-16`)                        |
| 14  | `src/app/(app)/collections/[collectionId]/page.tsx`                | 48 (`size-12`, empty state)    | 64 (`size-16`)                        |
| 15  | `src/app/(app)/quiz/page.tsx` (nếu có)                             | rà lại                         | 64 nếu < 64                           |

**Chỗ đã ≥ 64 — KHÔNG đụng:** study-mode-select (96), quiz-mode-select (96/64), match-session (80), memory-session (80), quiz result (80), runner-end-overlay (144), dashboard-motivation-bar (64), streak-milestone-banner (64), set-launcher-card (96), statistics-panel (64 heading).

**Lưu ý với mascot trong nút (paste-import #1, create-summary #6):** nâng lên 64px theo đúng yêu cầu user — điều chỉnh spacing của nút cho cân đối (nút có thể to hơn một chút) nhưng không phá layout. Nếu 64px trong nút quá to gây vỡ bố cục, được phép đưa mascot ra ngoài cạnh chữ trong cùng hàng — ghi rõ cách xử lý trong report.

## 2. Dialog thoát thêm mascot thinking

`src/features/learning-modes/components/exit-confirm-dialog.tsx` — thêm `<MascotImage state="thinking" size={64}>` vào dialog (vd phía trên tiêu đề "Thoát phiên?" hoặc cạnh text, chọn bố cục đẹp, mobile-friendly). Level: dùng `level={1}` (dialog không có streak context; nếu component đã nhận mascotLevel thì dùng prop đó — kiểm tra, nếu chưa có prop thì level 1).

- Import `MascotImage` từ `@/features/mascot/components/mascot-image`.
- Giữ nguyên: tiêu đề, text, 2 nút Hủy/Thoát, `DialogOverlay`, focus trap, Esc.

## 3. Verification

```bash
npm run check
npm run test:e2e -- foundation primary-navigation mobile-first-ui runner-setup match memory study-mode
```

Xác nhận cuối:

```bash
grep -rn "size={\(16\|24\|32\|40\|48\)}" src/ --include="*.tsx" | grep MascotImage -B 2 -A 2
```

→ không còn MascotImage nào < 64 (trừ test).

## 4. Commit

```bash
git add <các file thuộc task>
git commit -m "feat: enforce 64px minimum mascot size and add thinking mascot to exit dialog"
```

## 5. Evidence report

- Repository: start/final commit, push status.
- Bảng vị trí đã đổi: file → size cũ → size mới.
- Dialog thoát: ảnh mô tả cách bố trí mascot.
- Test: `npm run check`, E2E.
- Safety: migrations/DB/deps/env/AI/production = NO.
- Ambiguities.
- Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
