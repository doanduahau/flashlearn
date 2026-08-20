# Task N21b — Memory mode: flip 3D lật thẻ / úp thẻ khi nhấn ô

## Metadata

- Status: draft
- Baseline commit: `4527c7a`
- Agent tier: OpenCode + DeepSeek V4 Flash
- Decisions locked:
  - Thêm hiệu ứng **flip 3D** (rotateY) cho tile: úp → lật mở khi reveal, lật đóng khi úp lại.
  - Nội dung thẻ KHÔNG đổi: mặt reveal vẫn hiển thị `/mascot/logo.png`; text nội dung vẫn nằm ở box preview phía trên (giữ nguyên UX hiện tại).
  - Tôn trọng `prefers-reduced-motion` (transition tắt, vẫn hiển thị đúng mặt).
- Doc sync: docs/task-prompts/README.md

## Loại task

**Mức 1 — UI animation thuần.** Không đụng server, DB, logic game state.

## Bối cảnh

Màn Memory (`/memory/session`) hiện các tile chỉ đổi **màu nền + viền** khi lật (không có cảm giác "thẻ bài"). User muốn: **khi nhấn vào ô thì có hiệu ứng lật thẻ (mở) và úp thẻ (đóng).**

## File cần sửa

- `src/features/memory/components/memory-board.tsx` — component `MemoryTileButton` (dòng 229-275) và phần map tile (dòng 203-215).

## Yêu cầu chi tiết

Triển khai flip 3D thuần CSS cho mỗi tile, giữ nguyên hành vi game (state/phase/tap/disabled hoàn toàn không đổi):

- Cấu trúc tile:
  - `<li>` giữ `h-full w-full min-h-0 min-w-0`, thêm `[perspective:600px]`.
  - `<button>` giữ toàn bộ logic hiện có (disabled, aria-pressed, aria-label, data-testid, onClick), thêm `[transform-style:preserve-3d]` + `transition-transform duration-300 motion-reduce:transition-none`. Khi `revealed` (flipped hoặc matched) thêm `[transform:rotateY(180deg)]`.
  - Bên trong button: **2 mặt** tuyệt đối phủ kín, mỗi mặt `absolute inset-0 h-full w-full rounded-xl sm:rounded-2xl` + `[backface-visibility:hidden]`:
    - Mặt úp (front, hiển thị khi chưa reveal): nền `bg-info/20` + viền `border-2 border-border-soft`, thêm `hover:bg-info/30` (giữ tinh thần cũ). Có thể thêm biểu tượng nhỏ "?" hoặc logo mờ để gợi ý thẻ úp (tùy chọn, không bắt buộc).
    - Mặt lật (back, hiển thị khi reveal): `rotateY(180deg)`, nền `bg-primary-soft` + viền `border-2 border-primary`, chứa `<img src="/mascot/logo.png" className="h-4/5 w-4/5 object-contain" aria-hidden="true">`.
  - Matched: giữ ngữ nghĩa cũ (mờ đi) — thêm `opacity-50` cho cả button khi matched (thay vì đổi từng class mặt).
- Không đổi bất kỳ logic nào trong `MemoryBoard` (state machine, timer, preview box, confetti, pha mismatch/correct/celebration).
- Lưu ý border: dùng `border-2` cho cả 2 mặt để không giật layout khi lật.
- Reduced motion: `motion-reduce:transition-none` (flip tức thời, vẫn hiển thị đúng mặt reveal).

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Browser check: vào `/memory/session` — nhấn một tile: thẻ lật mở (rotateY 180) mượt ~300ms; nhấn tile khác / khi úp lại: lật đóng ngược lại; cặp khớp vẫn mờ đi; chạy E2E memory nếu có (`npm run test:e2e -- tests/e2e/` — kiểm tra test nào chạm memory-board để chắc không hỏng selector/data-testid).

## Constraints

- Không `any`/`@ts-ignore`. Không `--no-verify`.
- Chỉ sửa đúng 1 file. Không đổi `memory-state.ts`, `memory-session.tsx`, server actions, types.
- Commit riêng, message: `feat: add 3D flip animation to memory tiles`.

## Report cuối task

- Summary, files changed (diff), verification từng lệnh + kết quả browser check, remaining issues, commit hash + message.
