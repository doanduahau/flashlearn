# LP-14 — Security, capacity, infrastructure và production rollout

## 0. Metadata

- `Status`: planned; production portion blocked đến khi các task release scope verified
- `Difficulty`: 9/10 — rất cao
- `Risk`: production availability, cost, data recovery và access control
- `Dependencies`: LP-01–LP-13 theo feature được release
- `Suggested commit`: `docs: add library and plans production runbooks`
- `Independent review`: production readiness review bắt buộc

## 1. Mục tiêu

Đưa Starter/Catalog rồi Quota/Admin/Pricing/Billing ra production theo nhiều gate, không dùng production
làm môi trường test và đáp ứng RPO ≤ 24h, RTO ≤ 4h.

## 2. Infrastructure gate

Trước khi bán Pro:

- Vercel plan phù hợp commercial use và workload; staging project/environment riêng.
- Supabase capacity/backups phù hợp 150 card × user và growth forecast.
- Managed Redis/Upstash production riêng hoặc namespace/credential separation, có alert/quota.
- Sentry DSN/project/environment/release tags và alerts hoạt động.
- Gemini billing/spend caps/rate limits/usage dashboard.
- Domain CapyStudy, OAuth callback và email branding hoàn tất.
- Production access chỉ owner/CI-CD; không shared credential.
- Secrets staging/production tách biệt và rotation runbook.

Mọi chi phí mới phải được người dùng duyệt; ghi deferred item nếu chưa mua.

## 3. Capacity model

Đo/ước lượng:

- Existing users và starter rows cần backfill.
- DB bytes/card và index growth.
- Sets/cards/import distributions p50/p95/p99.
- Vercel CPU/memory/duration cho XLSX/DOCX/PDF.
- Supabase DB/egress/connections.
- Redis operations/latency/failure.
- Gemini calls/tokens/cost per source/plan.
- Heavy job concurrency/lock wait/stale jobs.
- Sentry event volume.

Định nghĩa thresholds và owner; không tăng quota thương mại chỉ vì test nhỏ pass.

## 4. Security review

- Threat model assets/actors/trust boundaries.
- RLS/grants toàn bộ bảng catalog/plan/usage/admin/billing.
- Service-role call sites, server-only imports và user ID provenance.
- Admin MFA/re-auth/last-owner/audit.
- Webhook signature/idempotency/out-of-order.
- File upload/decompression/mime/timeouts.
- Rate-limit/quota/concurrency/cost amplification.
- Public share rate-limit trước, CAPTCHA khi bất thường.
- Secret scan, dependency/SBOM/vulnerability review.
- Privacy: no content/email/token/payment data in telemetry.

## 5. Backup/recovery gate

- Backup trước migration/backfill/billing rollout.
- Xác minh backup retention và độc lập failure domain phù hợp.
- Restore staging từ backup hoặc bản tương đương.
- Đo RPO thực tế ≤24h và RTO diễn tập ≤4h.
- Runbook cho:
  - failed migration;
  - catalog bad content;
  - starter backfill partial;
  - Redis outage/stale locks;
  - Gemini outage/spend spike;
  - webhook outage/replay;
  - admin credential compromise;
  - database restore.

## 6. Release waves

### Wave 0 — Dark deploy

- Additive migrations và code với flags off/observe.
- Verify readiness, logs, metrics, DB indexes.

### Wave 1 — Owner/staging

- Owner/admin test accounts.
- Starter provision, catalog install, quota simulation, admin actions.
- Không real charge nếu billing chưa sandbox-complete.

### Wave 2 — Starter + Catalog

- Bật user mới trước.
- Backfill current users theo LP-05 batch.
- Catalog UI progressive enable.

### Wave 3 — Quota warn

- Observe → warn; so sánh false positives và legacy floor.
- Không block cho tới khi distribution/UX xác nhận.

### Wave 4 — Quota block + Admin

- Internal/canary trước.
- Theo dõi errors, support, spend và concurrency.

### Wave 5 — Pricing

- Public pricing, billing CTA vẫn off nếu provider chưa duyệt.

### Wave 6 — Billing

- Sandbox evidence, then owner real transaction nếu được duyệt.
- Limited rollout rồi public.

## 7. Automated quality gates

- `npm run format:check`.
- `npm run lint`.
- `npm run typecheck`.
- `npm run test`.
- `npm run build`.
- `npm run db:test` sau clean reset.
- Full local E2E.
- Staging smoke.
- PDF runtime/worker verification.
- Security/dependency scan phù hợp.
- Migration from clean DB và production-like snapshot staging.

Không release nếu E2E release blocker fail/hang hoặc migration/reconcile không có evidence.

## 8. Alerts và dashboards

- Auth/signup errors.
- Catalog install/provision/backfill error rate.
- Quota denied spike/mismatch.
- AI/provider error/latency/spend.
- Reservation/job stale/queue/lock contention.
- Admin authorization denied spike và sensitive audit actions.
- Billing invalid signature/webhook failure/subscription mismatch.
- DB capacity/egress/connection/disk.
- Redis availability/rate-limit fail-closed.

Alert phải có owner, severity, threshold và runbook link.

## 9. Rollback/roll-forward matrix

| Failure                | Immediate action                  | Data action                            |
| ---------------------- | --------------------------------- | -------------------------------------- |
| Catalog UI/install lỗi | Tắt `catalog_enabled`             | Giữ clone đã thành công                |
| Provision lỗi          | Tắt provisioning/backfill         | Retry idempotent sau sửa               |
| Quota false positive   | Chuyển `warn/observe`             | Không xóa ledger; reconcile            |
| AI spend spike         | Tắt AI generation/circuit breaker | Refund stale reservation theo evidence |
| Admin issue            | Tắt console, revoke role/secret   | Giữ audit logs                         |
| Checkout issue         | Tắt checkout                      | Vẫn nhận/reconcile webhook             |
| Bad migration          | Roll-forward ưu tiên              | Restore chỉ theo DR decision           |

## 10. Production acceptance criteria

- Staging bắt buộc và pass.
- Owner/CI-CD-only production access được xác minh.
- RPO/RTO rehearsal đạt mục tiêu.
- No unresolved critical/high security finding.
- Quota/AI cost không có bypass đã biết.
- Catalog/backfill capacity trong ngưỡng.
- Billing reconcile/runbook pass nếu mở billing.
- Dashboard/alerts/runbooks có owner.
- Release revision/migration version traceable.

## 11. Post-release

- Theo dõi sát mỗi wave; ghi actual metrics.
- Review quota và giá 39.000/390.000 bằng unit economics, không tự đổi.
- Xóa feature flags khi stable theo task riêng.
- Diễn tập restore định kỳ và rotate secrets.
- Ghi incident/postmortem nếu có user/data/payment impact.
