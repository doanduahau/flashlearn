# LP-01 — Baseline telemetry và feature flags

## 0. Metadata

- `Status`: planned
- `Difficulty`: 5/10 — trung bình
- `Risk`: medium; observability/privacy/configuration
- `Dependencies`: không
- `Suggested commit`: `feat: add plan usage telemetry foundations`

## 1. Mục tiêu

Tạo số liệu nền và cơ chế rollout trước khi thêm catalog/quota/billing. Task này chỉ quan sát, không
chặn người dùng và không thay đổi quyền lợi hiện tại.

## 2. Bối cảnh hiện tại

- Dự án có Sentry, structured logger, Upstash rate-limit và readiness checks.
- Import đã sinh một phần metrics trong kết quả document generation nhưng chưa có usage ledger chung.
- Chưa có feature flag domain cho catalog/quota/admin/billing.
- Không được log nội dung paste, file, flashcard hoặc token Google/Gemini.

## 3. Phạm vi

1. Định nghĩa taxonomy event/metric cho:
   - signup/provision attempt;
   - catalog browse/install;
   - import source, deterministic/AI split;
   - document extraction/generation;
   - typing AI review;
   - quota decision và rate-limit rejection.
2. Tạo correlation ID xuyên suốt logical job, reservation và provider call.
3. Thêm feature flag server-side theo `00-program-spec.md`.
4. Thêm helper ghi telemetry đã redact; không tạo analytics vendor mới nếu logger/Sentry đủ dùng.
5. Tạo script/report read-only để lấy baseline local/staging:
   - users, sets, cards distribution;
   - import volume/error;
   - DB growth signals có thể đọc được.
6. Cập nhật `.env.example`, `src/lib/env.ts`, deployment docs chỉ khi code thật sự cần biến mới.
7. Viết dashboard/query specification cho số liệu production không thể lấy tự động trong repo.

## 4. Ngoài phạm vi

- Không tạo plan/subscription/quota tables.
- Không chặn request.
- Không gửi nội dung người dùng tới analytics.
- Không thêm Segment/PostHog hoặc dependency telemetry mới nếu chưa được duyệt.
- Không truy vấn production trong lúc implement nếu chưa có quyền riêng.

## 5. Thiết kế và invariant

- Event name có namespace ổn định, ví dụ `usage.import.completed`.
- Metadata phải giới hạn cardinality; không đưa filename, email, raw URL hoặc error message tùy ý vào tag.
- Error dùng code chuẩn hóa; detail kỹ thuật vào Sentry exception đã redact.
- `quota_enforcement_mode=observe` không được từ chối request.
- Feature flag mặc định false cho catalog/admin/billing và `observe` cho quota.
- Sentry outage không làm hỏng import hoặc learning flow.

## 6. Files dự kiến

- `src/lib/telemetry/*` hoặc module hiện hữu phù hợp.
- `src/lib/env.ts`, `.env.example` nếu dùng env flags.
- Unit tests cho redaction, flag parsing và event shape.
- `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`.
- Không có migration trừ khi sau review chọn lưu durable events; mặc định không tạo DB ở task này.

## 7. Verification

- Unit: redaction không để lọt content/email/token; invalid flag fail startup hoặc default an toàn.
- Integration: telemetry failure không làm action chính fail.
- `npm run format:check`.
- `npm run check`.
- `git diff --check`.

## 8. Acceptance criteria

- Có danh sách metric đủ để đo dữ liệu trong Program Spec.
- Mỗi logical AI/document job có correlation ID.
- Không có PII/content trong fixture log.
- Tất cả flag có default, owner và mô tả rollout.
- Có baseline report template nhưng không chứa dữ liệu production thật trong git.

## 9. Rollout và rollback

- Deploy staging trước; kiểm tra event volume và Sentry cardinality.
- Production chỉ bật telemetry mức thấp, không bật feature.
- Rollback bằng tắt flag hoặc revert code; không có data migration.
