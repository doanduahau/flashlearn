# Task N21a — Quiz option: bỏ radio dot, ô chọn có màu + viền dày có màu

## Metadata

- Status: draft
- Baseline commit: `4527c7a`
- Agent tier: OpenCode + DeepSeek V4 Flash
- Decisions locked:
  - Giữ input radio `sr-only` để giữ nguyên accessibility (keyboard + screen reader), chỉ ẩn chấm tròn visual.
  - Trạng thái selected: cả ô đổi nền sang `primary-soft` + viền `border-primary` (dày `border-2`).
  - Không đổi luồng logic (submit/advance/feedback), không thêm hiệu ứng đúng/sai màu riêng.
- Doc sync: docs/task-prompts/README.md

## Loại task

**Mức 1 — UI thuần.** Không đụng server, DB, security.

## Bối cảnh

Màn kiểm tra trắc nghiệm (`/quiz/[attemptId]`) hiện hiển thị từng đáp án là một `<label>` chứa **chấm tròn radio native** (input `type="radio"`). User muốn:

1. Bỏ chấm tròn để chọn đi.
2. Khi chọn câu nào thì **nguyên ô đó có màu** (fill nền).
3. **Viền đáp án dày lên và có màu.**

## File cần sửa

- `src/features/quiz/components/quiz-session.tsx` — khối đáp án hiện ở dòng 111-130 (fieldset + các label).

## Yêu cầu chi tiết

Thay khối label hiện tại (dòng 113-128) như sau:

- Giữ nguyên `<input type="radio">` nhưng ẩn visual bằng `className="sr-only"`.
- Label trở thành ô đáp án:
  - Base: `flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all`
  - Chưa chọn: `border-border-soft bg-surface hover:bg-surface-subtle`
  - Đã chọn: `border-primary bg-primary-soft shadow-soft-card`
  - Giữ keyboard visibility: thêm `focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2` trên label.
- Text đáp án giữ nguyên màu `text-primary` (dễ đọc trên nền `primary-soft`).
- KHÔNG đổi `disabled` khi `pending`/`feedback !== null` (giữ nguyên như cũ).
- KHÔNG thêm icon check, KHÔNG thêm hiệu ứng đúng/sai màu riêng — đúng yêu cầu user.

Lưu ý: `shadow-soft-card` đã có sẵn trong `src/app/globals.css` (`@theme`, dòng 115) — không tạo token mới.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Browser check: vào `/quiz/[attemptId]` (hoặc màn quiz session) — bấm chọn đáp án: không còn chấm tròn, ô được chọn fill màu `primary-soft` + viền `primary` dày; keyboard (Tab + mũi tên / Space) vẫn chọn được; focus có ring.

## Constraints

- Không `any`/`@ts-ignore`. Không `--no-verify`.
- Chỉ sửa đúng 1 file. Không đổi logic submit/advance/feedback, không refactor.
- Commit riêng, message: `feat: redesign quiz answer options (colored selected cell + thick border)`.

## Report cuối task

- Summary, files changed (diff), verification từng lệnh + kết quả browser check, remaining issues, commit hash + message.
