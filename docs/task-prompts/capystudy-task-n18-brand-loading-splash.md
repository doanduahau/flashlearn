# Task N18 — Trang loading: logo to + 3 chấm đậm nhạt (BrandSplash)

## Loại task

**Giao diện / Trung bình** — UI, không chạm DB/security. Không cần review riêng.

## Baseline

- Branch: `main`
- Baseline commit: `9537d27` (đã push, main đồng bộ origin/main).
- Chỉ làm đúng phạm vi task này, không tạo commit từ baseline khác.

## Bối cảnh

Hiện mỗi route dùng `loading.tsx` hiển thị skeleton xương xám (`animate-pulse`) hoặc block trống. Người dùng muốn thay toàn bộ bằng **1 trang loading**: logo to + 3 chấm hiệu ứng "đậm nhạt" (nhấp nhô độ mờ), mượt, đẹp trên cả mobile và desktop — thay cho các dòng chữ "Đang tải…".

## Phạm vi

### 1. Component mới: `src/components/shared/brand-splash.tsx`

- **Server component** (không "use client"), API nhỏ: `export function BrandSplash({ title }: Readonly<{ title?: string }>)`.
- Bố cục:
  - `main` căn giữa theo cả 2 trục, `role="status"`, `aria-label={title || "Đang tải trang"}`, có `<span className="sr-only">{title || "Đang tải trang..."}</span>` (giữ nguyên accessibilily của PageSkeleton hiện tại).
  - Logo: `/mascot/logo.png` (đang dùng ở app chrome, kích thước 20px) — hiển thị **to** (khoảng 96–128px), nằm trong khối nền tròn/bo tròn `bg-primary-soft`, hiệu ứng xuất hiện nhẹ (fade + scale nhỏ, ~200–300ms một lần).
  - Bên dưới logo: **3 chấm ngang**, cùng màu token `bg-primary` (không hardcode hex), hiệu ứng đậm nhạt theo chuỗi: mỗi chấm nhấp nhô độ mờ (opacity ~0.25 → 1 → 0.25) với `animation-delay` so le (chấm 2 trễ ~150ms, chấm 3 trễ ~300ms), chu kỳ ~1.2s, easing tự nhiên. Các chấm `aria-hidden="true"` (trang trí).
  - Chiều cao: `min-h-[60vh]` (loading render trong vùng content của layout — không dùng `min-h-dvh` để không đẩy layout).
  - Dùng token thiết kế (bảng màu cam hiện tại của repo: `bg-primary`, `bg-primary-soft`, `bg-surface`...) — không hardcode màu. Mobile và desktop cùng bố cục căn giữa, không tràn ngang.
- Chống chuyển động: tôn trọng `prefers-reduced-motion` — khi giảm chuyển động, các chấm **đứng yên, hiển thị rõ** (không ẩn hẳn). Globals.css đã có block global `animation: none !important` — đảm bảo trạng thái tĩnh vẫn đẹp.

### 2. CSS — `src/app/globals.css`

- Thêm `@keyframes` cho chấm đậm nhạt (tên rõ, vd `splash-dot`) và hiệu ứng vào logo (vd `splash-in`).
- Đặt lớp (`.splash-dot`, ...) cùng nơi các keyframes hiện có (gần `confetti`/`card-in`/`fadeIn`). Không dùng inline style cho delay — dùng utility Tailwind `[animation-delay:150ms]`/`[animation-delay:300ms]` trên chấm 2, 3.

### 3. Cập nhật 19 file `loading.tsx` sang `BrandSplash`

Thay toàn bộ việc dùng `PageSkeleton`/block custom:

| File                                                   | Title                                            |
| ------------------------------------------------------ | ------------------------------------------------ |
| `src/app/(app)/loading.tsx`                            | "Đang tải..."                                    |
| `src/app/(app)/dashboard/loading.tsx`                  | "Đang tải tổng quan"                             |
| `src/app/(app)/study/mode/loading.tsx`                 | "Đang tải chế độ học"                            |
| `src/app/(app)/history/loading.tsx`                    | "Đang tải lịch sử bài test"                      |
| `src/app/(app)/collections/loading.tsx`                | "Đang tải bộ đặc biệt"                           |
| `src/app/(app)/collections/[collectionId]/loading.tsx` | "Đang tải chi tiết bộ đặc biệt"                  |
| `src/app/(app)/sets/loading.tsx`                       | "Đang tải danh sách bộ thẻ"                      |
| `src/app/(app)/sets/[setId]/loading.tsx`               | "Đang tải chi tiết bộ thẻ"                       |
| `src/app/(app)/sets/create/loading.tsx`                | "Đang tải trang tạo bộ thẻ"                      |
| `src/app/(app)/sets/library/loading.tsx`               | "Đang tải thư viện bộ thẻ"                       |
| `src/app/(app)/profile/loading.tsx`                    | "Đang tải trang cá nhân"                         |
| `src/app/(app)/match/loading.tsx`                      | "Đang tải ghép thẻ"                              |
| `src/app/(app)/memory/loading.tsx`                     | "Đang tải trò chơi lật hình"                     |
| `src/app/(app)/runner/loading.tsx`                     | "Đang tải Runner"                                |
| `src/app/(app)/quiz/loading.tsx`                       | "Đang tải nguồn kiểm tra" (đang là block custom) |
| `src/app/(app)/quiz/mode/loading.tsx`                  | "Đang tải chế độ kiểm tra"                       |
| `src/app/(app)/statistics/loading.tsx`                 | "Đang tải thống kê" (đang là skeleton custom)    |
| `src/app/(app)/study/loading.tsx`                      | "Đang tải nguồn học" (đang là block custom)      |
| `src/app/share/[token]/loading.tsx`                    | "Đang tải trang chia sẻ"                         |

### 4. Xóa dead code

- Sau khi chuyển hết, grep xác nhận `PageSkeleton` không còn được dùng ở đâu → **xóa** `src/components/shared/page-skeleton.tsx` và `tests/unit/components/shared/page-skeleton.test.tsx`.
- Thêm test mới `tests/unit/components/shared/brand-splash.test.tsx`: mô phỏng 2 assert cũ (aria-label mặc định "Đang tải trang" + aria-label theo title tùy chỉnh) và kiểm tra `role="status"`.

### 5. Ngoài phạm vi (KHÔNG làm)

- Không đổi nút/inline đang hiển thị "Đang tạo…"/"Đang tải…"/"Đang tải thẻ…" (share dialog, tạo bộ, quiz-mode-select, 3 session, study-source-select, quiz-setup, current-user, start-new-cards-button).
- Không đổi skeleton inline trong trang (`quiz/page.tsx`, `profile/page.tsx`, `source-browser.tsx`, `sets/library/page.tsx`).
- Không đổi offline page, auth/marketing (không có loading.tsx), không đổi app chrome.
- Không đổi màu/token; chỉ dùng token hiện có.
- Không cài dependency mới.

## Acceptance criteria

1. Tất cả 19 `loading.tsx` hiển thị logo to + 3 chấm đậm nhạt (không còn skeleton xám).
2. `aria-label` + `sr-only` text được giữ đúng (title từng route).
3. `prefers-reduced-motion`: không có animation nhảy; chấm đứng yên và vẫn nhìn rõ.
4. Hiển thị đẹp, căn giữa trên mobile và desktop, không tràn ngang.
5. Không còn tham chiếu `PageSkeleton` trong `src/` và `tests/`.
6. `npm run check` xanh.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E: chạy `npm run test:e2e` (hoặc batch foundation + 2–3 suite liên quan) — Docker đã chạy; nếu suite nào flake/ngoài phạm vi, báo rõ từng file trong report.

## Constraints (nhắc lại từ AGENTS.md)

- Không hardcode hex trong component sau khi token tồn tại.
- Không dùng `any`, `@ts-ignore`, cast tùy tiện.
- Không tạo CSS global cho style chỉ dùng trong một feature (splash dùng chung → đặt globals.css OK).
- Không thay đổi ngoài phạm vi.
- Không dùng `--no-verify` khi commit.

## Report cuối task

- Summary.
- Files changed (kèm dòng chính).
- Verification: kết quả từng lệnh (lint/typecheck/test/build) + E2E từng batch (pass/fail/ngoài phạm vi).
- Remaining issues.
- Commit hash + message.
