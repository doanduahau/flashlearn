# N21a-feedback — Quiz answer cell: trạng thái chọn (apricot) + feedback xanh/đỏ

> Iteration trên N21a (commit `dfb7218`). Chỉ cải thiện giao diện: **không thêm chữ, không thêm component mới, không thêm dependency, không đổi palette**.
> Trạng thái chọn hiện tại đã đúng (apricot `border-primary bg-primary-soft shadow-soft-card`). Thiếu: sau khi chấm, ô KHÔNG đổi màu. Cần thêm feedback xanh/đỏ.

## Scope

Sửa đúng 3 file:

1. `src/features/quiz/server/actions.ts`
2. `src/features/quiz/components/quiz-session.tsx`
3. `src/app/globals.css`

## Yêu cầu

### 1. Server action trả về `correctChoiceIndex`

- Thêm `correctChoiceIndex?: number` vào kiểu success của `Result` (dòng 18-20, `actions.ts`).
- Trong `submitQuizAnswer`, sau khi RPC `submit_quiz_answer` thành công, query `correct_choice_index` từ bảng `quiz_questions` (row của chính user, RLS `select_own` cho phép):
  ```ts
  const { data: q } = await supabase
    .from("quiz_questions")
    .select("correct_choice_index")
    .eq("id", parsed.data.questionId)
    .maybeSingle();
  ```
- Best-effort: nếu query lỗi/không có dữ liệu thì KHÔNG trả field này (UI degrade gracefully). KHÔNG làm fail answer.
- Return: `{ ok: true, correct, completed, correctChoiceIndex }`.

### 2. quiz-session.tsx — feedback màu cho ô đáp án

- Thêm state `correctChoiceIndex: number | null`; set từ `result.correctChoiceIndex` (có thể là `undefined`).
- Class của `label` đáp án theo 2 giai đoạn:
  - **Chưa chấm** (`feedback === null`): giữ nguyên hiện tại — selected → `border-primary bg-primary-soft shadow-soft-card`, còn lại → `border-border-soft bg-surface hover:bg-surface-subtle`.
  - **Đã chấm** (`feedback !== null`):
    - `index === correctChoiceIndex` → xanh: `border-success bg-success-soft` (ô đáp án đúng luôn tô xanh).
    - `feedback === false && index === selected` → đỏ: `border-danger bg-danger-soft` (ô chọn sai).
    - còn lại → `border-border-soft bg-surface`.
  - Fallback khi `correctChoiceIndex === null`: nếu `feedback === true` thì tô xanh ô `selected`; nếu `feedback === false` chỉ tô đỏ ô `selected` (không tô xanh).
- **Tăng thời gian thấy màu xanh khi đúng:** câu đúng non-final hiện `router.refresh()` ngay lập tức (xanh không thấy được). Đổi thành `window.setTimeout(() => router.refresh(), ADVANCE_DELAY_MS)` — dùng `advanceTimerRef` để cleanup (pattern đã có ở final). KHÔNG đổi delay của final, KHÔNG đổi "Câu tiếp theo"/auto-advance semantics.
- Giữ nguyên: `sr-only` radio, `border-2`, `focus-within:ring-2`, status text "Chính xác."/"Chưa chính xác.", auto-advance khi đúng.

### 3. globals.css — token mới

Thêm vào `:root`:

```css
--success-soft: #eef8f1;
--danger-soft: #fdf0ee;
```

Và wire vào `@theme inline`:

```css
--color-success-soft: var(--success-soft);
--color-danger-soft: var(--danger-soft);
```

KHÔNG hardcode hex trong component; dùng token `bg-success-soft` / `bg-danger-soft` / `border-success` / `border-danger`.

## Frozen rules

- Chỉ sửa 3 file trên. Không refactor file khác.
- Không thêm text/component/dependency. Không đổi palette apricot. Không khôi phục radio dot.
- Không sửa migration. Không dùng `any`, `@ts-ignore`, `eslint-disable`.
- Giữ accessibility: trạng thái đúng/sai vẫn có text status (không chỉ màu).

## Verification gates (bắt buộc trước khi xong)

1. `npm run lint` — 0 errors (36 warnings pre-existing là OK).
2. `npm run typecheck` — pass.
3. `npm run test` — vitest pass (không fail test cũ; nếu action thay đổi làm fail unit test nào đó thì SỬA TEST theo đúng hành vi mới).
4. `npm run build` — pass (5 warning phaser benign là OK).
5. E2E quiz-path phải xanh (chạy bằng `npm run test:e2e -- <spec>`):
   - `tests/e2e/quiz-advancement.spec.ts` (2/2)
   - `tests/e2e/quiz-result-collections.spec.ts` (6/6)
   - `tests/e2e/smart-review.spec.ts` (4/4)
   - `tests/e2e/new-cards.spec.ts` (1/2 — test 1 fail pre-existing do seedDueCards stale, không phải lỗi task này)
   - `tests/e2e/memory.spec.ts` (6/6) — chỉ để chắc không ảnh hưởng chéo
   - Lưu ý: delay 800ms mới có thể chạm auto-advance assertions — verify kỹ `answerQuestion` helper vẫn pass.

## Evidence report

- Danh sách file đổi + diff.
- Kết quả từng gate ở trên (kèm số liệu).
- Kết quả E2E từng spec (pass/fail + lý do nếu fail không thuộc task).
- KHÔNG commit, KHÔNG push. Trả về report cho coordinator.
