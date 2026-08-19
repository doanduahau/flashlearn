# LP-06 — Giao diện Thư viện Flashcard và onboarding

## 0. Metadata

- `Status`: planned
- `Difficulty`: 7/10 — cao
- `Risk`: medium; navigation conflict, async install UX, accessibility/responsive
- `Dependencies`: LP-03, LP-04; LP-05 cho onboarding banner hoàn chỉnh
- `Suggested commit`: `feat: add flashcard catalog experience`

## 1. Mục tiêu

Thêm lựa chọn “Thư viện Flashcard” cạnh hai launcher hiện tại và trang catalog để browse, preview,
install vào “Flash card của bạn”.

## 2. Route và navigation

- Giữ `/sets/library` là “Flash card của bạn” để tránh đổi link hiện tại.
- Tạo `/sets/catalog` cho thư viện hệ thống.
- `/sets` hiển thị ba launcher:
  1. Tạo Flashcard.
  2. Flashcard của bạn.
  3. Thư viện Flashcard.
- Mobile xếp dọc; desktop dùng 3 cột khi đủ rộng, không ép chữ/mascot.
- Back button catalog trở về `/sets`.

## 3. Catalog page

- Server Component load category/set published theo pagination.
- Khu “Bộ khởi đầu” và danh mục.
- Search sanitized, category/language/level filters nếu dữ liệu có.
- Card: title, description, category, languages, level, card count, installed badge.
- Preview route/drawer hiển thị sample cards, không tải toàn bộ catalog nếu không cần.
- Install button:
  - pending/disabled chống double-click ở UI;
  - server vẫn idempotent;
  - success dẫn tới set hoặc cho “Mở bộ”;
  - already exists dẫn đến bản hiện có;
  - quota/error hiển thị inline, giữ state/filter.
- Loading, empty, search-empty, error/retry.

## 4. Onboarding banner

- Sau provision completed lần đầu, dashboard hoặc `/sets` hiển thị một lần:
  “CapyStudy đã chuẩn bị 3 bộ flashcard để bạn bắt đầu học ngay.”
- Không modal blocking.
- Có CTA “Xem các bộ”.
- Acknowledgement state không được làm hỏng provision state.

## 5. Accessibility và responsive

- Link/card có focus-visible.
- Button cao tối thiểu khoảng 44px trên mobile.
- Installed state không chỉ bằng màu.
- Preview dialog nếu dùng phải trap focus và có close label.
- Search/filter có label; error dùng `role=alert` khi phù hợp.
- Reduced motion được tôn trọng.

## 6. Ngoài phạm vi

- Không marketplace/user publishing/rating/comment.
- Không admin editor.
- Không recommendation AI.
- Không đổi route `/sets/library`.
- Không thêm ảnh catalog nếu không có asset được duyệt.

## 7. Files dự kiến

- `src/app/(app)/sets/page.tsx`.
- `src/app/(app)/sets/catalog/*`.
- `src/features/catalog/components/*`, `server/*`, `schemas/*`.
- Tests unit/component/E2E.
- `docs/ROUTES.md`, tài liệu feature liên quan.

## 8. Tests và acceptance

- Launcher thứ ba hiển thị đúng mobile/desktop/keyboard.
- Search/filter/pagination giữ URL state.
- Preview đúng content và order.
- Install success/already exists/quota/error.
- Double-click chỉ tạo một set.
- Bộ clone xuất hiện trong `/sets/library` và dùng được trong ít nhất Study + Quiz E2E; các mode khác được integration regression bảo vệ.
- Banner chỉ hiển thị theo contract.
- Không phụ thuộc optimized image URL trong assertions.

## 9. Verification

- Component tests.
- E2E catalog/install/onboarding.
- `npm run check`.
- Full local E2E runner vì navigation `/sets` thay đổi.
- `git diff --check`.

## 10. Rollout/rollback

- Deploy với `catalog_enabled=false`.
- Bật staging và owner trước.
- Rollback bằng flag; route có thể tồn tại nhưng server redirect/not-found an toàn khi off.
