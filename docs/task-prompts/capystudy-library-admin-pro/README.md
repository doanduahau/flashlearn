# CapyStudy Library, Admin và Free/Pro — Delivery Plan

## Mục đích

Thư mục này là bộ đặc tả triển khai cho chương trình gồm bốn nhóm chức năng:

1. Ba bộ flashcard khởi đầu cho tài khoản hiện tại và tương lai.
2. Thư viện flashcard hệ thống để người dùng thêm bộ vào tài khoản.
3. Tài khoản và giao diện quản trị có phân quyền, audit.
4. Gói Free, Pro tháng và Pro năm với quota, chống abuse và vòng đời subscription.

Đây là tài liệu chuẩn bị triển khai. Việc tạo các file này không cho phép tự động sửa code,
chạy migration production, bật billing hoặc tạo tài khoản trên dịch vụ bên ngoài.

## Quyết định đã chốt

- Thương hiệu hiển thị: **CapyStudy**.
- Ba bộ khởi đầu riêng, khoảng 50 thẻ mỗi bộ.
- Hai bộ từ vựng có hướng **Tiếng Việt → Tiếng Anh**.
- Bộ kiến thức gồm khoảng 50 thẻ khoa học và xã hội kết hợp.
- Starter set là bản clone độc lập: người dùng được sửa, đổi tên và xóa.
- Xóa starter/catalog set thì được cài lại; tại một thời điểm chỉ có một bản active từ cùng template.
- Bản đã cài không tự cập nhật khi catalog thay đổi.
- Provision sau xác nhận email hoặc lần đăng nhập đầu tiên; không chèn 150 thẻ trong Auth trigger.
- Free: 20 bộ thường, 3.000 thẻ; Pro: 200 bộ thường, 30.000 thẻ.
- Pro tháng: **39.000đ/tháng**.
- Pro năm: **390.000đ/năm**, cùng quyền lợi và quota reset theo tháng.
- Không khóa các chế độ học cơ bản trên Free.
- Owner dự kiến: `phamvandoan707@gmail.com`; không hardcode email này trong frontend hoặc migration nền tảng.
- Đồng ý nâng hạ tầng production phù hợp trước khi mở thanh toán.
- Payment provider chưa chốt; entitlement/quota phải hoàn thành trước billing.

Chi tiết chuẩn sản phẩm, quota và các invariant dùng chung nằm trong
[`00-program-spec.md`](./00-program-spec.md).

## Thang độ khó

| Điểm | Mức            | Ý nghĩa                                                            |
| ---: | -------------- | ------------------------------------------------------------------ |
|  1–3 | Thấp           | Thay đổi cục bộ, ít trạng thái, không chạm dữ liệu nhạy cảm        |
|  4–6 | Trung bình     | Nhiều component/module hoặc cần migration đơn giản                 |
|  7–8 | Cao            | Chạm DB/RLS, nhiều trạng thái lỗi, cần integration/E2E             |
|    9 | Rất cao        | Concurrency, backfill, service-role, audit hoặc lifecycle phức tạp |
|   10 | Tối quan trọng | Tiền, webhook, quota atomic hoặc khả năng khuếch đại chi phí       |

## Thứ tự triển khai bắt buộc

| ID    | Task                                                                                      | Độ khó | Phụ thuộc                        | Có thể chặn release |
| ----- | ----------------------------------------------------------------------------------------- | -----: | -------------------------------- | ------------------- |
| LP-01 | [Baseline telemetry và feature flags](./01-baseline-telemetry.md)                         |   5/10 | Không                            | Có                  |
| LP-02 | [Entitlement và quota foundation](./02-entitlement-quota-foundation.md)                   |   9/10 | LP-01                            | Có                  |
| LP-03 | [Catalog database và clone RPC](./03-catalog-database.md)                                 |   8/10 | LP-02                            | Có                  |
| LP-04 | [Nội dung ba bộ khởi đầu](./04-starter-content.md)                                        |   6/10 | LP-03                            | Có                  |
| LP-05 | [Provisioning và backfill](./05-starter-provisioning-backfill.md)                         |   9/10 | LP-03, LP-04                     | Có                  |
| LP-06 | [Giao diện thư viện flashcard](./06-catalog-ui.md)                                        |   7/10 | LP-03, LP-04                     | Không               |
| LP-07 | [Quota storage và import deterministic](./07-deterministic-import-storage-enforcement.md) |   9/10 | LP-02                            | Có                  |
| LP-08 | [AI, tài liệu nặng và Typing](./08-ai-heavy-job-enforcement.md)                           |  10/10 | LP-01, LP-02, LP-07              | Có                  |
| LP-09 | [Admin RBAC và bootstrap owner](./09-admin-rbac-owner-bootstrap.md)                       |   9/10 | LP-01                            | Có                  |
| LP-10 | [Admin console](./10-admin-console.md)                                                    |   8/10 | LP-03, LP-09                     | Không               |
| LP-11 | [Pricing và giao diện gói](./11-pricing-plan-ui.md)                                       |   6/10 | LP-02, LP-07, LP-08              | Không               |
| LP-12 | [Downgrade và subscription lifecycle](./12-downgrade-subscription-lifecycle.md)           |   8/10 | LP-02, LP-11                     | Có trước billing    |
| LP-13 | [Billing provider và webhook](./13-billing-provider-integration.md)                       |  10/10 | LP-02, LP-09, LP-12              | Có; đang blocked    |
| LP-14 | [Security, capacity và production rollout](./14-security-scale-production-rollout.md)     |   9/10 | LP-01–LP-13 theo phạm vi release | Có                  |

LP-03 đến LP-06 có thể phát triển thành một release “Starter + Catalog” trước khi bật quota
blocking hoặc billing. LP-07 và LP-08 phải hoàn thành trước khi public Pro.

## Quy tắc thực hiện mỗi task

1. Đọc toàn bộ `AGENTS.md`, `docs/ENGINEERING_STANDARDS.md`, file task và dependency của task.
2. Kiểm tra baseline bằng `git status`, `git log -1`, test liên quan và migration head.
3. Không sửa migration đã áp dụng; luôn tạo migration mới.
4. Task chạm DB phải có pgTAP/RLS/grant tests và chạy `npx supabase db reset` trước `npm run db:test`.
5. Task chạm tiền, quyền, quota, service-role hoặc backfill phải được review độc lập trước production.
6. Mỗi task là một commit có phạm vi rõ; không gộp refactor/format/dependency không liên quan.
7. Không push hoặc apply production nếu chưa có xác nhận riêng cho bước đó.
8. Bắt buộc chạy `npm run check`, `git diff --check`, xem `git status`, `git diff --stat`, `git diff`.
9. UI task phải kiểm tra mobile, desktop, keyboard, loading, empty, error và reduced motion nếu liên quan.
10. Mọi rollout production phải qua staging, backup và rollback/roll-forward plan.

## Quy tắc báo cáo

Mỗi task phải trả về đúng các nhóm:

- Summary.
- Files changed.
- Database changes.
- Environment variables.
- Commands executed.
- Verification: format, lint, typecheck, unit, DB, build, E2E.
- Security/data/production impact.
- Remaining issues.
- Commit hash và push/migration status.

## Điều kiện dừng

Agent phải dừng và hỏi người dùng nếu:

- Cần chọn payment provider.
- Dữ liệu production thực tế mâu thuẫn với quota đã chốt.
- Owner email chưa tồn tại trong Supabase Auth lúc bootstrap.
- Backfill dry-run cho thấy thời gian/khối lượng vượt ngưỡng đã định trong LP-05.
- Cần đọc nội dung riêng tư của người dùng để vận hành admin/support.
- Cần thêm dependency hoặc dịch vụ trả phí chưa được duyệt.
- Cần thay đổi giá, quota, grace period hoặc quyền lợi đã chốt.
