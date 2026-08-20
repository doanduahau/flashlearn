# LP-04 — Nội dung ba bộ flashcard khởi đầu

## 0. Metadata

- `Status`: planned
- `Difficulty`: 6/10 — trung bình nhưng cần kiểm duyệt nội dung
- `Risk`: content accuracy, duplication, licensing và seed repeatability
- `Dependencies`: LP-03
- `Suggested commit`: `feat: seed starter flashcard catalog`

## 1. Mục tiêu

Tạo dữ liệu catalog production-ready cho ba starter set, không gọi AI runtime và không phụ thuộc một
tài khoản user cụ thể.

## 2. Nội dung đã chốt

### Bộ 1 — Trái cây

- Khoảng 50 thẻ.
- Front: tên tiếng Việt thông dụng.
- Back: từ tiếng Anh chuẩn.
- Ưu tiên dạng số ít/canonical; không trộn IPA hoặc câu ví dụ nếu chưa có quyết định mới.

### Bộ 2 — Động vật

- Khoảng 50 thẻ.
- Front: tên tiếng Việt thông dụng.
- Back: từ tiếng Anh chuẩn.
- Tránh mục mơ hồ có nhiều bản dịch nếu không ghi rõ ngữ cảnh.

### Bộ 3 — Khoa học và xã hội

- Khoảng 50 thẻ kết hợp.
- Hỏi–đáp tiếng Việt, ngắn gọn, dễ kiểm chứng.
- Tránh số liệu thay đổi nhanh, chính trị hiện thời, lời khuyên y khoa/pháp lý hoặc fact gây tranh cãi.

## 3. Quy trình biên soạn

1. Soạn source data version-controlled ở định dạng dễ review.
2. Normalize whitespace/newline nhưng không lowercase nội dung hiển thị.
3. Kiểm tra exact duplicate và duplicate sau normalize.
4. Review ngôn ngữ bởi người đọc độc lập.
5. Review fact khoa học/xã hội; ghi nguồn tham khảo trong tài liệu biên tập nếu cần, không chèn URL dài vào card.
6. Chuyển source thành seed idempotent hoặc migration data có stable IDs/slugs.
7. Seed dev/test và production theo cùng contract.

## 4. Invariant dữ liệu

- Mỗi set nằm trong khoảng đã chốt; target chính xác 50 nếu không có lý do biên tập.
- Không front/back rỗng hoặc vượt plan soft max.
- Position liên tục, deterministic.
- Không có HTML/script.
- Không chứa nội dung vi phạm bản quyền; không sao chép nguyên bộ thương mại.
- `is_starter=true`, order 1–3, status published chỉ sau review.
- Re-run seed không tạo duplicate hoặc reset version ngoài ý muốn.

## 5. Ngoài phạm vi

- Không provision user.
- Không thêm ảnh/audio/IPA/example schema.
- Không AI generate trong request production.
- Không mở catalog cho user trước LP-06 và rollout flag.

## 6. Files dự kiến

- `supabase/seed.sql` hoặc data module/fixture theo quyết định review.
- Nếu production seed cần migration: migration additive riêng, không nhúng backfill user.
- Tests kiểm tra count, slug, orientation, duplicate và idempotency.
- Tài liệu content review/license note.

## 7. Tests và acceptance

- Local reset tạo đúng 3 starter set và card counts.
- Hai vocabulary set có front tiếng Việt, back tiếng Anh.
- Science/social set là tiếng Việt và không trùng.
- Seed chạy lại không nhân bản.
- Catalog published query trả đúng thứ tự.
- Human review checklist được ký/ghi trạng thái trong evidence.

## 8. Verification

- `npx supabase db reset`.
- `npm run db:test` nếu có migration/schema query.
- Unit content validation.
- `npm run check`.
- `git diff --check`.

## 9. Rollout/rollback

- Catalog flag false trong khi seed production.
- Có thể unpublish template để rollback mà không xóa clone đã cài.
- Không sửa card của user khi sửa seed/catalog version.
