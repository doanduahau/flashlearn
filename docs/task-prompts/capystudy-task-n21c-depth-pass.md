# Task N21c — Depth pass: thêm chiều sâu (đổ bóng + độ nổi) cho surface khắp app

## Metadata

- Status: draft
- Baseline commit: `4527c7a`
- Agent tier: OpenCode + DeepSeek V4 Flash
- Decisions locked:
  - Dùng token đã có `shadow-soft-card` (`0 8px 24px rgba(74,50,14,0.08)`) làm mức shadow chuẩn cho panel; thêm 1 token hover `shadow-soft-card-hover` (đậm hơn) cho phần tử tương tác.
  - Thay `shadow-soft` (TOKEN CHẾT — không tồn tại) bằng `shadow-soft-card`.
  - Gom 3 chỗ shadow xanh cũ (green-tinted) về `shadow-soft-card` (nhất quán palette apricot).
  - KHÔNG tạo Card primitive/refactor 60 chỗ. Chỉ áp dụng recipe cho danh sách surface cụ thể bên dưới.
  - Hover dùng nâng bóng (`transition-shadow hover:shadow-soft-card-hover`), KHÔNG dùng translate-y cho card/row (trừ button).
- Doc sync: docs/task-prompts/README.md

## Loại task

**Mức 1 — UI thuần.** Không đụng server, DB, logic.

## Bối cảnh

User đánh giá UI nhìn **2D quá** (phẳng, chỉ có viền, không có chiều sâu). Cần trang trí lại component để có lớp nổi (elevation) nhất quán với token shadow apricot đã có.

## 1. Token CSS — `src/app/globals.css`

Trong block `@theme inline` (dòng 64-120), bên cạnh `--shadow-soft-card` (dòng 115), thêm:

```css
--shadow-soft-card-hover: 0 12px 28px rgba(74, 50, 14, 0.12);
--shadow-soft-card-up: 0 -8px 24px rgba(74, 50, 14, 0.08);
```

## 2. Fix token chết `shadow-soft` (đang render phẳng)

Thay `shadow-soft` → `shadow-soft-card` tại:

- `src/features/quiz/components/quiz-mode-select.tsx:38` (const `CARD_CLS`)
- `src/features/study/components/study-mode-select.tsx:126`, `:161`, `:234`
- `src/features/typing/components/typing-session.tsx:360`

## 3. Gom shadow xanh cũ về token apricot

Thay shadow arbitrary `shadow-[0_8px_24px_rgba(39,93,70,0.08)]` → `shadow-soft-card` tại:

- `src/features/special-collections/components/card-collections-control.tsx:154`
- `src/features/auth/components/current-user.tsx:99`
- `src/features/learning-modes/components/sticky-start-bar.tsx:24` (dùng `shadow-soft-card-up` vì là bar dưới, bóng hất lên)

## 4. Button — `src/components/ui/button.tsx`

- Variant `default` và `primary`: nâng `shadow-sm` → `shadow-soft-card`, thêm `transition-all active:translate-y-px` (cảm giác ấn xuống).
- Variant `soft`, `outline`, `destructive`: thêm `shadow-soft-card` mức nhẹ (giữ nguyên bg/border), `transition-all active:translate-y-px`.
- Giữ nguyên mọi thứ khác.

## 5. Áp dụng elevation cho surface (theo danh sách chốt)

Recipe:

- Panel tĩnh: thêm `shadow-soft-card`.
- Card/row tương tác: thêm `transition-shadow hover:shadow-soft-card-hover` (giữ hover bg hiện có).
- KHÔNG sửa màu nền/border/radius có sẵn, chỉ THÊM shadow (+ transition/hover shadow).

Danh sách (file:line từ khảo sát):

1. Dashboard — `src/app/(app)/dashboard/page.tsx`: tile `:105`, `:116` (panel tĩnh), bar học tập `:127`, panel hoạt động tháng `:142`.
2. Set launcher — `src/features/flashcard-sets/components/set-launcher-card.tsx:22` (card tương tác: + hover lift).
3. Flashcard list items — `src/features/mastery/presentation/mastery-presentation.ts:51-55` (hàm `masteryCardClassName` — thêm `shadow-soft-card` vào base; dùng ở sets + collections). Chú ý KHÔNG đổi phần tint theo mastery status.
4. Setup rows — `src/features/source-selection/components/source-browser.tsx:115`, `:135` (row tương tác: + hover lift).
5. Question count — `src/features/learning-modes/components/question-count-selector.tsx:24` (panel tĩnh).
6. Statistics — `src/features/statistics/components/statistics-panel.tsx:141` (stat tiles tĩnh), `:70` (history items tương tác + hover), `:167` (panel link summary + hover).
7. List rows — `src/features/flashcard-sets/components/sets-list.tsx:36`, `src/features/special-collections/components/collections-list.tsx:44`, `src/features/flashcard-sets/components/set-reorder-list.tsx:100` (row tương tác + hover lift).
8. Bottom nav — `src/components/layout/app-navigation.tsx:92`: thêm `shadow-soft-card-up` + `transition-shadow`.
9. Sidebar — `src/components/layout/app-chrome.tsx:40`: thêm `shadow-soft-card-up` mức nhẹ (hoặc `shadow-soft-card` tùy khớp mắt, ưu tiên nhẹ).

## Ngoài phạm vi (KHÔNG đụng)

- `quiz-session.tsx` (đã giao N21a), `memory-board.tsx` (đã giao N21b), `match-board.tsx` (giữ nguyên).
- Study flashcard card (`study-session.tsx`) — đã có `shadow-lg ring-4` là chuẩn depth, giữ nguyên.
- Dialogs/auth cards — đã có `shadow-soft-card`, không sửa.
- Không refactor, không tạo component mới, không đổi design tokens khác.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Browser check: chạy app, mở dashboard, /sets, /quiz, /study, /statistics — surface có bóng mềm + độ nổi; hover card/row nâng nhẹ; không vỡ layout, không shadow đen đậm; contrast không đổi.

## Constraints

- Không `any`/`@ts-ignore`. Không `--no-verify`.
- Chỉ sửa đúng các file trong danh sách.
- Commit riêng, message: `feat: add depth and elevation to UI surfaces`.

## Report cuối task

- Summary, files changed (diff), verification từng lệnh + kết quả browser check, remaining issues, commit hash + message.
