# LP-10 — Admin console cho catalog, user, quota và jobs

## 0. Metadata

- `Status`: planned
- `Difficulty`: 8/10 — cao
- `Risk`: high; privileged mutations, privacy, large queries và audit completeness
- `Dependencies`: LP-03, LP-09; LP-02 cho plan/usage; LP-08 cho jobs
- `Suggested commit`: `feat: add audited administration console`

## 1. Mục tiêu

Tạo `/admin` server-first, chỉ hiển thị và cho phép đúng capability; không trở thành công cụ truy cập
toàn bộ dữ liệu hoặc service-role tùy ý.

## 2. Navigation và layout

- `/admin` không xuất hiện với non-admin.
- Server guard ở admin layout và từng action.
- Navigation theo permission, không chỉ role name.
- Trang có banner “Môi trường staging/production” rõ để tránh thao tác nhầm.
- Sensitive mutation có confirmation, reason và pending/error state.

## 3. Dashboard

Chỉ số tổng hợp, không tải danh sách lớn vào client:

- Total/active users nếu có metric đáng tin.
- Free/Pro distribution.
- Catalog installs và starter provisioning states.
- Import/AI/heavy job success/error.
- Quota rejections, stale reservations/jobs.
- Links tới Sentry/operational dashboards nếu cấu hình, không embed secret.

## 4. Catalog management

- List/search/filter draft/published/archived.
- Create/edit metadata và cards với validation hiện có.
- Preview trước publish.
- Publish/unpublish/archive có audit.
- Version increment semantics đúng LP-03.
- Mark/unmark starter chỉ owner/content_admin theo policy; không để 0 hoặc >3 starter published mà không cảnh báo/block theo invariant.
- Không mutate user clones.

## 5. User/support view

- Search exact email hoặc UUID từ trusted server; không expose bulk email list mặc định.
- Hiển thị profile-safe fields, plan/status/period, usage snapshot, provisioning và job summary.
- Không hiển thị password, sessions, raw token, document/card content.
- Suspend expensive operations là capability riêng, không đồng nghĩa khóa đọc/học dữ liệu.
- Usage/entitlement adjustment:
  - bounded value;
  - expiry bắt buộc khi phù hợp;
  - reason bắt buộc;
  - append-only ledger/audit;
  - idempotency.

## 6. Jobs và reconciliation

- List failed/stale jobs bằng pagination.
- Retry chỉ với job type được phép và idempotent.
- Không có nút “retry all” production không giới hạn.
- Hiển thị safe error code/correlation ID; link Sentry theo trace nếu có.
- Refund/finalize manual chỉ owner hoặc support permission riêng và audit.

## 7. Role management

- Chỉ owner.
- Exact user lookup, confirmation và reason.
- Không cho xóa owner cuối.
- Không dùng email hardcoded để bypass.
- Role change phải invalid/revalidate admin UI và có audit.

## 8. Ngoài phạm vi

- Không impersonation.
- Không sửa card riêng tư của user.
- Không bulk delete user/data.
- Không raw SQL/query builder.
- Không payment refund trước provider integration.
- Không realtime dashboard nếu polling/server refresh đủ.

## 9. Performance/privacy

- Pagination và indexed query; không `select *` cho user/jobs/audit.
- Aggregate query/RPC có bound.
- Email chỉ xuất hiện trên exact support lookup và không log.
- Audit page có retention/pagination.
- Export admin data chưa hỗ trợ.

## 10. Tests bắt buộc

- Permission matrix cho mỗi page/action.
- Direct URL/action invocation bị chặn.
- Catalog draft/publish/version/invariant.
- User exact search/no bulk leak.
- Adjustment audit/idempotency/bounds.
- Job retry/refund permission và duplicate request.
- Last-owner rule.
- Loading/empty/error/mobile basic accessibility.

## 11. Verification và rollout

- Unit/component/integration/E2E admin.
- `npm run check`, DB tests nếu RPC/query mới, `git diff --check`.
- Security/privacy review.
- Deploy flag off → staging owner → production owner only.
- Rollback bằng flag; privileged RPC vẫn giữ authorization, không phụ thuộc flag.
