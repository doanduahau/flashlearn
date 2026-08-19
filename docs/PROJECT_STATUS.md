# CapyStudy — Trạng thái dự án và production

> Cập nhật lần cuối: 2026-08-20  
> Phạm vi: hạ tầng, cấu hình production, database, quota, backup và trạng thái triển khai các hạng mục thương mại.  
> Không ghi secret, token, DSN hoặc giá trị biến môi trường vào tài liệu này.

## Cách đọc trạng thái

- ✅ **Đã xác minh**: đã triển khai và có kết quả kiểm tra hoặc bằng chứng vận hành.
- ⚠️ **Đã có nhưng chưa hoàn tất vận hành**: code/quy trình đã tồn tại nhưng chưa bật, chưa diễn tập hoặc chưa có đủ bằng chứng production.
- ⏳ **Chưa làm / gác lại**: chưa triển khai hoặc chủ động để sau.
- ❓ **Cần xác nhận**: có thể đã cấu hình ngoài repo nhưng chưa có record để kiểm chứng.

## Tổng quan hiện tại

| Hạng mục                  | Trạng thái | Ghi chú                                                                                              |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| Staging riêng             | ✅         | Branch `staging`, Vercel Preview riêng và readiness trả `204`                                        |
| Production                | ✅         | Branch `main`, readiness trả `204`                                                                   |
| Redis managed             | ✅         | Tách riêng `capystudy-staging` và `capystudy-production`                                             |
| Sentry                    | ✅         | DSN theo môi trường; test event staging đã nhận với `environment=staging`                            |
| Supabase/Auth             | ✅         | Biến môi trường và redirect URL staging đã cấu hình                                                  |
| Migration production      | ✅         | Local/remote đồng bộ đến `20260819220000`                                                            |
| RLS                       | ✅         | Đã rà soát, không phát hiện bảng public cần thiết bị tắt RLS                                         |
| Storage preflight         | ✅         | Production preflight đạt; max card-side `81`, số card-side trên `50.000` là `0`                      |
| Storage quota enforcement | ⚠️         | Đang ở `observe`; chưa bật `warn` hoặc `block`                                                       |
| Backup production         | ⚠️         | Workflow read-only và một lần chạy thử thành công; lịch chạy hằng ngày chưa có record trong tài liệu |
| Restore/RTO               | ⏳         | Chưa diễn tập restore trên Supabase project cô lập; chưa chứng minh RTO ≤ 4 giờ                      |
| Custom domain CapyStudy   | ⏳         | Chưa hoàn tất                                                                                        |
| Email branding/SMTP       | ⏳         | Chưa hoàn tất                                                                                        |

## 1. Môi trường và quy trình triển khai

### Đã có và đã xác minh

- **Staging**
  - Git branch: `staging`.
  - Vercel Preview: `https://flashlearn-git-staging-pham-van-doans-projects.vercel.app`.
  - Readiness endpoint `/api/health/ready` đã trả `204`.
- **Production**
  - Git branch: `main`.
  - URL hiện tại: `https://flashlearn-six.vercel.app`.
  - Readiness endpoint `/api/health/ready` đã trả `204`.
- Staging và production dùng cấu hình môi trường riêng.
- Quy trình phát hành yêu cầu kiểm tra staging trước khi lên production đã được ghi trong tài liệu vận hành.

### Cần xác nhận thêm

- ❓ Chưa có record trong repo chứng minh quyền production trên Vercel/Supabase đã được giới hạn chỉ cho owner và CI/CD. Cần lưu ảnh hoặc biên bản kiểm tra quyền sau khi cấu hình.

## 2. Dịch vụ ngoài và biến môi trường

### Redis / Upstash

- ✅ Production dùng Redis managed `capystudy-production`.
- ✅ Staging dùng Redis managed `capystudy-staging`.
- ✅ Hai môi trường không dùng chung Redis.
- Redis hiện phục vụ các cơ chế bảo vệ như rate limit/circuit breaker; không được hiểu là toàn bộ dữ liệu ứng dụng đã được cache bằng Redis.

### Sentry

- ✅ Sentry DSN đã được cấu hình theo môi trường.
- ✅ Probe staging tạm thời đã gửi event `capystudy-staging-sentry-test` thành công.
- ✅ Event đã được xác nhận có `environment=staging`.
- ✅ Endpoint probe tạm `/api/sentry-test` và test liên quan đã được xóa sau khi xác minh.
- Việc xóa probe không thay đổi cấu hình Sentry runtime hiện tại.

### Vercel environment variables

Các nhóm biến đã được cấu hình riêng cho staging/production:

- Supabase.
- Upstash Redis.
- Sentry.
- `HEALTHCHECK_TOKEN`.
- `CAPYSTUDY_ENVIRONMENT`.
- `NEXT_PUBLIC_APP_URL`.
- Gemini/Google variables cần cho production.

Không ghi giá trị thật của các biến trên vào Git hoặc tài liệu.

### Supabase Auth

- ✅ Đã thêm redirect URL cho staging.
- ⏳ Custom domain chưa có nên callback/domain chính thức mang thương hiệu CapyStudy chưa hoàn tất.
- ⏳ Email branding và SMTP riêng chưa hoàn tất.

## 3. Database, migration và RLS

### Migration

- ✅ Đã phục hồi chính xác ba migration bị thiếu trong lịch sử Git:
  - `20260819160000`.
  - `20260819170000`.
  - `20260819180000`.
- ✅ Đã điều tra schema drift còn lại và không còn blocker đã biết.
- ✅ Đã review và áp bốn migration pending lên production.
- ✅ Production remote hiện ở migration `20260819220000`.
- ✅ Lịch sử local và remote đã được ghi nhận là đồng bộ tại thời điểm kiểm tra.

### RLS

- ✅ Đã rà soát RLS trên schema public.
- ✅ Không phát hiện bảng public cần bảo vệ bị tắt RLS.

### Storage quota

- ✅ Script `npm run storage:preflight:production` đã được sửa để chạy với cấu hình Node/tsx hiện tại.
- ✅ Script vẫn chỉ đọc dữ liệu, không thay đổi production database.
- ✅ Production preflight đã đạt:
  - Card-side dài nhất: `81` ký tự.
  - Card-side trên `50.000` ký tự: `0`.
- ⚠️ `storage_enforcement_mode` hiện là `observe`.
- ⚠️ Chưa được coi là đã rollout enforcement cho người dùng cho đến khi hoàn tất telemetry/warning, review độc lập và phê duyệt riêng trước khi chuyển sang `warn` hoặc `block`.

## 4. Backup và khôi phục

### Đã có

- ✅ Có lệnh `npm run backup:production`.
- ✅ Backup chạy theo nguyên tắc read-only đối với production.
- ✅ Workflow xuất roles, schema và data.
- ✅ Có SHA-256 manifest để kiểm tra tính toàn vẹn.
- ✅ Có retention mặc định 35 ngày.
- ✅ Thư mục `backups/` đã được gitignore.
- ✅ Một lần backup production đã chạy thử thành công.

### Chưa đủ để tuyên bố đạt RPO/RTO

- ❓ Chưa có record xác nhận backup đã được lên lịch tự động tối thiểu mỗi 24 giờ. Vì vậy chưa thể khẳng định RPO ≤ 24 giờ chỉ dựa trên một lần chạy thử.
- ⏳ Chưa restore drill trên Supabase project cô lập.
- ⏳ Chưa đo và ghi nhận thời gian phục hồi thực tế, nên RTO ≤ 4 giờ chưa được chứng minh.
- Không restore thử vào production.

## 5. Trạng thái các hạng mục sản phẩm/thương mại liên quan

- ✅ Nền tảng entitlement/quota và storage enforcement đã có trong code/database theo các migration đã triển khai.
- ⚠️ Enforcement storage mới ở chế độ quan sát, chưa chặn người dùng.
- ⚠️ Starter provisioning/backfill production không được coi là hoàn tất nếu chưa có execution record xác nhận review độc lập, staging, dry-run dữ liệu thật, capacity, backup/restore và owner approval cho write-mode.
- ⚠️ Admin/billing có thể có foundation hoặc feature flag trong code, nhưng chưa được coi là đang hoạt động thương mại trên production khi chưa có record kích hoạt và kiểm thử end-to-end.
- ⏳ Gói Pro/thanh toán thực tế chưa được đánh dấu là production-ready trong record hiện tại.

Chi tiết inventory tính năng ứng dụng nằm trong `docs/PROJECT_KNOWLEDGE/07_FEATURES.md`. Tài liệu này không thay thế kiểm thử acceptance của từng feature.

## 6. Những việc còn lại

### Ưu tiên cao — độ tin cậy production

1. ⏳ Chạy restore drill trên một Supabase project cô lập.
2. ⏳ Ghi lại thời gian restore và xác nhận RTO ≤ 4 giờ.
3. ❓ Xác nhận backup production được lên lịch tự động đủ để đáp ứng RPO ≤ 24 giờ.
4. ❓ Xác nhận quyền production chỉ dành cho owner/CI-CD và lưu bằng chứng kiểm tra.

### Trước khi bật quota `warn` hoặc `block`

1. Hoàn tất telemetry cho các trường hợp “would block”.
2. Kiểm tra warning UI và hành vi downgrade/hết hạn.
3. Chạy review độc lập theo rollout contract.
4. Ghi owner approval riêng trước khi thay đổi enforcement mode.

### Thương hiệu và vận hành

1. ⏳ Thêm custom domain CapyStudy và cập nhật DNS/Vercel.
2. ⏳ Cập nhật OAuth callback, app URL và allowlist theo domain mới.
3. ⏳ Cấu hình Supabase email branding và SMTP.
4. ⏳ Khi bật cron push notification, rà lại `pg_net` schema và cập nhật runbook trước khi rollout.

## 7. Các commit mốc

- `369dba9` — restore missing migration history.
- `0c2e3eb` — fix production storage preflight.
- `2525927` — record production deployment.
- Có các commit tạm trên staging để thêm rồi xóa Sentry probe; probe không còn trong runtime hiện tại.

## 8. Tài liệu nguồn

- `docs/DEPLOYMENT.md` — record triển khai và rollback.
- `docs/MANUAL_PRODUCTION_SETUP.md` — cấu hình thủ công staging/production.
- `docs/BACKUP_AND_RECOVERY.md` — backup, restore và mục tiêu RPO/RTO.
- `docs/PRODUCTION_DEFERRED_COSTS.md` — việc gác lại hoặc cần dịch vụ trả phí.
- `docs/task-prompts/capystudy-library-admin-pro/` — đặc tả và acceptance criteria của chương trình library/admin/pro.

## 9. Quy tắc cập nhật tài liệu này

Chỉ chuyển một hạng mục sang ✅ khi có ít nhất một bằng chứng phù hợp:

- Kết quả command/test kèm ngày chạy.
- Migration version đã đối chiếu local/remote.
- HTTP status hoặc event quan sát được trên dịch vụ thật.
- Execution record/runbook có người xác nhận.
- Commit hoặc deployment record tương ứng.

Mỗi lần thay đổi migration, môi trường, dịch vụ ngoài, quota mode, backup hoặc domain, cập nhật ngày và trạng thái trong file này cùng task thay đổi.
