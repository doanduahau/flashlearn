# LP-05 — Starter provisioning và backfill tài khoản hiện tại

## 0. Metadata

- `Status`: implemented — production rollout/backfill pending independent review, verified backup and explicit capacity approval
- `Difficulty`: 9/10 — rất cao
- `Risk`: high data volume, partial failure, duplicate creation và Auth reliability
- `Dependencies`: LP-03, LP-04
- `Suggested commits`:
  - `feat: provision starter sets for new accounts`
  - `chore: add resumable starter set backfill`
- `Independent review`: bắt buộc trước production backfill

## 1. Mục tiêu

Đảm bảo tài khoản đã xác nhận có đúng ba starter set, bao gồm user hiện tại và user tương lai, mà
không chèn 150 card vào `handle_new_user` hoặc làm hỏng đăng ký.

## 2. Provision user mới

### Trigger point

- Sau email confirmation hoặc lần authenticated app load đầu tiên.
- App layout/server boundary có thể gọi một orchestrator nhẹ.
- Orchestrator kiểm tra trạng thái provision trước khi clone.
- Không block toàn bộ dashboard nếu catalog tạm lỗi; hiển thị app và retry sau.

### State

Cần durable state hoặc suy ra an toàn từ install records:

- `pending`, `running`, `completed`, `partial`, `failed`.
- `attempt_count`, `last_error_code`, timestamps.
- Không lưu raw exception hoặc email.

### Idempotency

- `provisionStarterSets(userId)` gọi install RPC cho từng starter template.
- Retry toàn hàm hoặc một template không tạo duplicate.
- Hai tab/login đồng thời không tạo sáu bộ.
- Nếu 2/3 thành công, lần sau chỉ bổ sung bộ còn thiếu.

## 3. Backfill user hiện tại

Tạo script/operator command riêng:

- Bắt buộc `--dry-run` mặc định.
- Batch size cấu hình nhỏ và có hard max.
- Cursor/checkpoint ổn định theo user ID/created_at; không dùng offset dễ trượt.
- Resume được sau crash.
- Throttling giữa batch, không tạo burst DB.
- Giới hạn concurrency.
- Summary: eligible, already complete, created, partial, failed, estimated card rows.
- Không log email; chỉ ID/error code.
- Không tự chạy khi deploy/migration.
- Production execution yêu cầu backup đã verify và xác nhận riêng.

## 4. Quota semantics

- Starter 150 card tính vào `cards.total.max`.
- Provision là system action nhưng vẫn không vượt hard DB safety.
- Đối với account legacy đang gần/vượt Free, cập nhật legacy floor/override trước hoặc cùng transaction để không khóa bất ngờ.
- Không trừ AI/heavy/import quota.

## 5. Failure handling

- Catalog unavailable: mark retryable, không fail login.
- Một set invalid/unpublished: fail closed cho set đó và alert operator.
- Quota/reservation failure do cấu hình: không clone một phần ngoài transaction của set; provision remains partial.
- Script SIGINT/crash: checkpoint chỉ tiến sau khi batch durable.
- Retry có bounded backoff; không vòng lặp vô hạn.

## 6. Ngoài phạm vi

- Không gửi email marketing.
- Không tự mở catalog UI.
- Không update starter clone cũ.
- Không chạy backfill production trong task implementation.

## 7. Tests bắt buộc

- User mới nhận 3 set đúng content/order.
- Lần gọi thứ hai tạo 0 set.
- Hai call concurrent vẫn chỉ 3 set.
- Partial failure rồi retry hoàn tất.
- Catalog flag off không làm app fail.
- User xóa starter rồi provision nền không tự cài lại ngoài explicit reinstall; trạng thái completed phải phân biệt xóa chủ động.
- Backfill dry-run không ghi DB.
- Resume từ checkpoint không bỏ/nhân user.
- Legacy overage không bị khóa dữ liệu cũ.

## 8. Capacity gate trước production

Dry-run phải báo:

```text
new_flashcard_sets ≈ eligible_users × missing_starter_sets
new_flashcards ≈ tổng missing cards của các starter
estimated_database_growth
estimated_batch_duration
```

Nếu số liệu thực tế vượt capacity đã duyệt, dừng và xin quyết định; không tự tăng batch/concurrency.

## 9. Verification

- `npx supabase db reset` và `npm run db:test` nếu thêm DB state/RPC.
- Integration tests provisioning/backfill.
- E2E confirmed user onboarding.
- `npm run check`, `git diff --check`.
- Staging backfill dry-run và batch thử bằng test users.

## 10. Rollout/rollback

1. Deploy code với flag off.
2. Bật cho test owner trên staging.
3. Bật provisioning user mới.
4. Dry-run existing users.
5. Backup production.
6. Chạy batch nhỏ, kiểm tra DB/error/latency.
7. Tăng dần trong giới hạn đã duyệt.

Rollback bằng tắt provisioning/backfill. Không tự xóa bộ đã cấp; nếu content sai thì unpublish và xử
lý bằng kế hoạch dữ liệu riêng có xác nhận.
