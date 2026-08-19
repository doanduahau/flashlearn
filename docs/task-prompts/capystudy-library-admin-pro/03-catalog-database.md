# LP-03 — Catalog database, provenance và clone RPC

## 0. Metadata

- `Status`: planned
- `Difficulty`: 8/10 — cao
- `Risk`: high; RLS, clone atomic, storage growth và concurrency
- `Dependencies`: LP-02
- `Suggested commit`: `feat: add flashcard catalog database foundation`
- `Independent review`: bắt buộc

## 1. Mục tiêu

Tạo nguồn catalog lưu một lần và RPC cài một template thành bộ thường độc lập của user. Tái sử dụng
pattern `clone_shared_set` nhưng không dùng share token làm catalog identity.

## 2. Schema mục tiêu

### `catalog_categories`

- `id`, stable `slug`, localized `name`, optional description, `sort_order`, active timestamps.
- Slug unique, normalized, không dùng tên hiển thị làm khóa.

### `catalog_sets`

- `id`, category, slug, title, description.
- `language_front`, `language_back`, optional level/tags.
- `status`: draft/published/archived.
- `version` integer tăng khi publish revision mới.
- `is_starter`, `starter_order`, author/editor metadata phù hợp.
- Published timestamp; card count không lưu cache nếu chưa chứng minh cần.

### `catalog_cards`

- `catalog_set_id`, front, back, position, timestamps.
- Ownership thuộc hệ thống, không có user_id giả.
- Unique position hoặc thứ tự deterministic.

### `user_catalog_installs`

- `user_id`, `catalog_set_id`, `installed_set_id`, `catalog_version`.
- Trạng thái active/deleted hoặc lịch sử đủ để cho phép reinstall.
- Unique partial constraint bảo đảm một active install/user/template.

### Provenance trên `flashcard_sets`

- `source_catalog_set_id` nullable.
- `source_catalog_version` nullable.
- Không expose field nội bộ không cần thiết cho public share.

## 3. RLS và quyền

- Authenticated chỉ đọc category/set/card `published`.
- Draft/archived chỉ admin path đọc sau LP-09; trước đó service_role trusted server.
- User chỉ đọc install record của mình.
- User không trực tiếp insert/update/delete catalog.
- Anon không đọc catalog trong phạm vi task này.
- Service-role clone RPC phải xác thực user từ trusted server action.

## 4. `install_catalog_set` RPC

Input tối thiểu: trusted `user_id`, catalog set UUID, idempotency key.

Hành vi:

1. Validate identity và published status.
2. Lấy advisory/row lock theo user+catalog.
3. Nếu active install tồn tại và set còn tồn tại: trả set cũ, `already_exists=true`.
4. Nếu clone cũ bị xóa: cho phép clone mới và cập nhật install state.
5. Đếm card, kiểm tra per-install cap và gọi storage entitlement gate từ LP-02.
6. Insert set + cards + install record trong một transaction.
7. Chỉ copy front/back/position và metadata được chốt; không copy learning history.
8. Trả `set_id`, `already_exists`, usage delta.

Không dùng UI double-click prevention làm lớp chống trùng duy nhất.

## 5. Catalog version semantics

- Clone lưu version tại thời điểm cài.
- Edit/publish version mới không mutate clone cũ.
- Archive template không xóa clone.
- Không xây auto-update/merge.
- Admin không được sửa trực tiếp published revision mà không tăng version hoặc có audit.

## 6. Ngoài phạm vi

- Chưa thêm 150 card thật; LP-04.
- Chưa provision user; LP-05.
- Chưa catalog UI; LP-06.
- Chưa admin UI; LP-10.
- Không public marketplace/user publishing.

## 7. Tests bắt buộc

- pgTAP schema/RLS/grants/constraints.
- User đọc published, không đọc draft; anon bị chặn.
- Clone giữ đúng order và content; không copy stats/history.
- Retry/idempotency trả set cũ.
- Hai clone đồng thời chỉ tạo một set.
- Xóa clone rồi reinstall tạo bản mới.
- Archive/update catalog không đổi clone cũ.
- Storage quota decision được gọi và block đúng trong `block` mode; observe không block.
- Rollback toàn transaction khi insert card/install lỗi.

## 8. Verification

- `npx supabase db reset`.
- `npm run db:test`.
- Integration test server action.
- `npm run check`.
- `git diff --check`.
- Independent security/DB review.

## 9. Acceptance criteria

- Catalog là nguồn hệ thống riêng, không dùng tài khoản user giả làm owner.
- Bản cài tương thích hoàn toàn với query hiện tại của `flashcard_sets`.
- Không có duplicate active install.
- Không có đường ghi catalog từ browser.
- Clone atomic, idempotent, observable và quota-aware.

## 10. Rollout/rollback

- Additive migration; catalog flag vẫn false.
- Chưa seed production ở task này.
- Revert code/flag để dừng install; giữ bảng/provenance.
