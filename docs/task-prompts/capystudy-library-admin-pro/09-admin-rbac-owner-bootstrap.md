# LP-09 — Admin RBAC, audit foundation và bootstrap owner

## 0. Metadata

- `Status`: planned
- `Difficulty`: 9/10 — rất cao
- `Risk`: critical security/service-role/privilege escalation
- `Dependencies`: LP-01
- `Suggested commit`: `feat: add audited admin role foundation`
- `Independent review`: bắt buộc

## 1. Mục tiêu

Tạo authorization boundary cho admin và cơ chế cấp role `owner` cho tài khoản đã chốt mà không có
tài khoản dùng chung, secret trong source hoặc đường tự nâng quyền.

## 2. Roles v1

| Role            | Quyền                                                 |
| --------------- | ----------------------------------------------------- |
| `owner`         | Toàn bộ quyền admin, role/override/billing control    |
| `content_admin` | Catalog CRUD, preview, publish/unpublish              |
| `support`       | User/plan/usage read, adjustment có giới hạn và audit |
| `analyst`       | Chỉ đọc metrics tổng hợp                              |

Role string phải có constraint. Permission checks nên map tập trung, không rải điều kiện email/role
trong page/action.

## 3. Schema và audit

### `user_roles`

- `user_id`, `role`, created_by, created_at, optional revoked_at.
- Một user có thể có nhiều role nếu cần; effective permission là union có kiểm soát.
- Không lưu role authoritative chỉ trong client claims nếu không có quy trình refresh/revoke rõ.

### `admin_audit_logs`

- Append-only: actor, action, target type/id, request/correlation ID, reason, safe before/after summary, timestamp.
- Không lưu password/token/payment secret/raw document.
- Authenticated thường không đọc được.
- Admin audit read theo permission; write chỉ trusted function.
- Không cho UPDATE/DELETE thông thường.

## 4. Server authorization

- `/admin` layout gọi server-side guard trước khi query data.
- Mỗi server action/RPC kiểm tra permission riêng; route visibility không đủ.
- Service-role chỉ được tạo bên trong server-only module.
- Target user/role/action validated; owner không được tự revoke owner cuối cùng nếu điều đó làm mất toàn bộ quản trị.
- Sensitive actions yêu cầu reason; owner role changes yêu cầu re-auth/MFA khi capability sẵn sàng.

## 5. Bootstrap owner

Tài khoản được chỉ định: `phamvandoan707@gmail.com`.

Quy trình:

1. User phải tồn tại và đã xác nhận trong Supabase Auth.
2. Chạy script/operator command server-side nhận email qua argument/input operator.
3. Resolve email → user UUID bằng Supabase Admin API/trusted DB.
4. Kiểm tra exact normalized email và confirmation.
5. Upsert role `owner` idempotent.
6. Ghi audit bootstrap với actor/operator context.
7. Không commit email/password/token vào migration nền tảng hoặc frontend.
8. Script mặc định dry-run và không chạy trong deploy.

Nếu email chưa tồn tại, dừng với hướng dẫn; không tự tạo user/password.

## 6. Admin capability v1

Foundation chỉ cung cấp permission API cho LP-10:

- `catalog.read/write/publish`.
- `users.read/status.write`.
- `usage.read/adjust`.
- `subscriptions.read/override`.
- `jobs.read/retry`.
- `audit.read`.
- `roles.manage` chỉ owner.

## 7. Ngoài phạm vi

- Không admin UI ngoài minimal forbidden/guard test page nếu cần.
- Không impersonation.
- Không raw SQL console.
- Không xem password hoặc auth token.
- Không cho support đọc nội dung riêng tư mặc định.
- Không suspend/delete production user trong task foundation.

## 8. Tests bắt buộc

- RLS/grants user_roles/audit.
- Non-admin, analyst, support, content_admin, owner permission matrix.
- Client forge role/hidden route/direct server action bị chặn.
- Revoked role mất quyền.
- Last-owner invariant.
- Bootstrap dry-run/no user/unconfirmed/idempotent/success.
- Audit ghi đúng actor/action/target/reason và redact.
- Service-role module không import được vào client bundle.

## 9. Verification

- `npx supabase db reset`, `npm run db:test`.
- Unit/integration authorization tests.
- E2E non-admin forbidden và owner staging access bằng test fixture, không dùng email production trong test.
- `npm run check`, `git diff --check`.
- Independent security review.

## 10. Rollout/rollback

- Migration additive; admin flag off.
- Bootstrap staging owner/test account trước.
- Production bootstrap là thao tác thủ công có approval và evidence.
- Tắt admin flag không thu hồi role; rollback quyền bằng audited revoke operator procedure.
