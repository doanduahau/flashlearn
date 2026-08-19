# LP-02 — Entitlement, usage ledger và quota reservation foundation

## 0. Metadata

- `Status`: planned
- `Difficulty`: 9/10 — rất cao
- `Risk`: critical data/concurrency; nền móng của mọi quota và billing
- `Dependencies`: LP-01
- `Suggested commit`: `feat: add entitlement and quota ledger foundation`
- `Independent review`: bắt buộc vì chạm DB, concurrency và quyền lợi thương mại

## 1. Mục tiêu

Xây core có thể thêm plan/quota/billing mà không viết lại import/catalog. Kết thúc task, hệ thống resolve
Free/Pro và ghi usage/reservation ở chế độ `observe`; chưa block user production.

## 2. Phạm vi database

Tạo migration mới, không sửa migration cũ:

1. `plans`: `free`, `pro_monthly`, `pro_yearly`; trạng thái active/version.
2. `plan_entitlements`: typed key, numeric/text/bool value, effective version.
3. `user_subscriptions`: plan, status, period start/end, grace end, provider fields nullable.
4. `entitlement_overrides`: support/admin override có expiry và reason.
5. `usage_periods`: cửa sổ quota tháng/ngày, timezone/canonical timestamps rõ ràng.
6. `usage_ledger`: append-only debit/credit/adjustment với idempotency key.
7. `quota_reservations`: reserved/finalized/refunded/expired, requested/actual amount.
8. `processing_jobs`: logical job state và correlation/idempotency.
9. Index/unique constraint để chặn duplicate ledger/reservation/job.

Tên/cột cuối cùng phải được review theo schema hiện tại. Không nhét mọi state vào `profiles` JSON.

## 3. RLS, grants và trust boundary

- User chỉ select usage/subscription/entitlement view của chính mình nếu UI cần.
- User không insert/update ledger, subscription, override hoặc job state trực tiếp.
- Mutation đi qua SECURITY DEFINER RPC hoặc trusted server action với `user_id` lấy từ claims.
- Service-role RPC phải validate actor/target/action; không nhận user ID từ client rồi tin trực tiếp.
- `anon` không có quyền.
- Override/admin adjustment bắt buộc audit ở LP-09; trước LP-09 chỉ hỗ trợ fixture/test hoặc trusted script.

## 4. Domain service

Triển khai API trong Program Spec:

- `getEffectivePlan` với fallback Free an toàn.
- `getEntitlement` typed; unknown key fail closed cho mutation tốn tài nguyên.
- `getUsageSnapshot`.
- `reserveUsage`, `finalizeUsage`, `refundUsage`.
- Reservation expiry/reconciliation contract.
- Period calculator:
  - Free theo tháng UTC đã định;
  - Pro theo subscription anchor;
  - Annual vẫn tạo monthly period;
  - daily action dùng rolling window khi ghi trong spec.

## 5. Concurrency và idempotency bắt buộc

- Hai request đồng thời không được cùng reserve vượt remaining quota.
- Cùng `idempotency_key + user + usage_key` trả reservation/result cũ.
- Finalize/refund lặp lại không thay đổi tổng usage lần hai.
- Actual lớn hơn reserved chỉ được finalize nếu còn quota hoặc policy cho phép; không âm quota.
- Job/reservation crash giữa chừng có trạng thái phục hồi rõ.
- Ledger append-only; không update/xóa entry tài chính/quota để “sửa số”.
- Clock boundary và event out-of-order phải có test.

## 6. Seed entitlement

Seed/insert idempotent đúng các key và giá trị trong `00-program-spec.md`. Price có thể lưu ở billing
configuration sau; entitlement không phụ thuộc trực tiếp vào giá 39.000/390.000.

## 7. Ngoài phạm vi

- Không enforce ở toàn bộ import.
- Không payment checkout/webhook.
- Không admin UI.
- Không tự động cấp Pro cho owner.
- Không xóa usage history.

## 8. Tests bắt buộc

### pgTAP

- Schema, constraints, indexes, RLS, grants.
- User A không xem usage/subscription của B.
- Authenticated không tự ghi ledger/subscription/override.
- Default Free và Pro tháng/năm resolve đúng.
- Unique/idempotency constraints.
- Reserve đồng thời không vượt quota.
- Finalize/refund idempotent.
- Monthly/annual period boundary.

### Unit/integration

- Typed entitlement parsing.
- Missing/invalid plan fail safe.
- Observe mode ghi decision nhưng không block.
- Provider field nullable và không ảnh hưởng manual entitlement.

## 9. Verification gates

1. `npx supabase db reset`.
2. `npm run db:test`.
3. `npm run check`.
4. `git diff --check`.
5. Independent DB/security review APPROVE.

## 10. Acceptance criteria

- Core không chứa `if (isPro)` rải rác.
- Không thể double-spend quota bằng concurrent requests.
- Annual quota reset monthly.
- Free fallback không phụ thuộc browser state.
- Usage có thể reconcile từ ledger/reservation.
- Chế độ production ban đầu là observe.

## 11. Rollout/rollback

- Migration additive, code cũ vẫn chạy.
- Deploy migration → code observer → kiểm tra metrics.
- Rollback code không cần drop bảng.
- Không contract/drop bảng trong cùng release.
