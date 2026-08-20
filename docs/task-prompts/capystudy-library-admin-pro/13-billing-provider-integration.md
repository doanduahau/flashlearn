# LP-13 — Billing provider, checkout, webhook và reconciliation

## 0. Metadata

- `Status`: blocked — cần người dùng chọn provider/pháp nhân/currency/tax/refund policy
- `Difficulty`: 10/10 — tối quan trọng
- `Risk`: money, webhook forgery, duplicate/out-of-order events, chargeback và entitlement correctness
- `Dependencies`: LP-02, LP-09, LP-12
- `Suggested commits`: tách provider adapter, checkout, webhook/reconcile thành commit reviewable
- `Independent review`: bắt buộc trước staging và production

## 1. Blocker cần chốt

Không implement provider-specific code trước khi xác nhận:

- Provider/cổng thanh toán hỗ trợ pháp nhân và thị trường mục tiêu.
- Thu VND trực tiếp hay quy đổi.
- VAT/invoice/tax responsibility.
- Refund/cancel/chargeback policy.
- Phương thức thanh toán và recurring subscription có thực sự được hỗ trợ.
- Ai sở hữu dashboard, secret và quyền refund.

Không chọn provider chỉ vì SDK phổ biến. Không cài dependency khi blocker chưa giải quyết.

## 2. Mục tiêu sau khi unblock

Tích hợp provider qua adapter, map checkout/webhook thành subscription domain của LP-02/LP-12; không
để provider SDK hoặc event name lan vào import/catalog/UI entitlement.

## 3. Provider adapter contract

```ts
createCheckoutSession(userId, priceKey, successUrl, cancelUrl);
createCustomerPortalSession(userId, returnUrl);
verifyWebhook(rawBody, signature);
mapProviderEvent(verifiedEvent);
fetchSubscriptionSnapshot(providerSubscriptionId);
```

- Price mapping server-only.
- Chỉ cho `pro_monthly=39.000đ` và `pro_yearly=390.000đ` đã cấu hình.
- Không tin price/amount/plan từ browser.
- Success redirect không tự cấp Pro; webhook/reconcile authoritative.

## 4. Checkout security

- Auth + CSRF/origin validation phù hợp Next server boundary.
- Rate-limit checkout creation.
- Idempotency key user+plan+attempt.
- Validate safe redirect, không open redirect.
- Provider customer reuse; không tạo customer vô hạn khi retry.
- Secret chỉ server env; `.env.example` dùng placeholder.

## 5. Webhook processing

- Đọc raw body đúng yêu cầu provider trước parse.
- Verify signature/timestamp; invalid → 4xx và không ghi state.
- Persist `provider_event_id` unique trước/with processing.
- Handler idempotent.
- Event out-of-order dùng occurred_at/version/provider snapshot, không arrival order đơn giản.
- Transaction ghi billing event + subscription transition.
- Unknown event an toàn, observable, không tự cấp entitlement.
- Response nhanh; work retryable chuyển sang job nếu provider timeout yêu cầu.
- Không log raw body/signature/payment data.

## 6. Event mapping tối thiểu

- Checkout/order completed.
- Subscription active/renewed.
- Cancel at period end/canceled.
- Payment failed/past due.
- Subscription expired.
- Refund/chargeback nếu provider có.

Mỗi event map sang state machine LP-12; không viết state transition thứ hai song song.

## 7. Reconciliation

- Scheduled/manual job so sánh local subscription với provider snapshot.
- Pagination, rate-limit, checkpoint và dry-run.
- Safe correction ghi event/audit, không update im lặng.
- Dashboard/alert cho webhook failure, signature failure spike, stale past_due, mismatch.
- Runbook replay một event theo ID mà vẫn idempotent.

## 8. Admin/support

- Admin chỉ xem safe billing summary/status/reference.
- Refund/cancel từ admin chỉ khi provider/policy đã duyệt; nếu làm phải re-auth, reason, audit và idempotency.
- Không hiển thị card/bank details.
- Owner/CI-CD quản lý secret; support không xem secret.

## 9. Tests bắt buộc

- Official provider webhook fixtures/signature.
- Invalid signature/timestamp/body.
- Duplicate event, retry, out-of-order.
- Checkout amount/price tampering.
- Success redirect không cấp Pro.
- Monthly/yearly mapping và quota anchor.
- Cancel/past_due/refund/chargeback transitions.
- DB failure giữa event/subscription ghi atomic.
- Reconciliation dry-run/resume/correction.
- No secrets/payment details in logs/errors/client bundle.

Không gọi provider thật trong unit/CI. Staging/sandbox E2E dùng tài khoản test chính thức.

## 10. Verification gates

- `npx supabase db reset`, `npm run db:test`.
- Unit/integration/webhook fixtures.
- Provider sandbox E2E tháng/năm/cancel/failure.
- `npm run check`, full release E2E, `git diff --check`.
- Security review và commercial policy review APPROVE.
- Runbook/reconciliation/alerts hoàn tất.

## 11. Environment/configuration

Tên biến phụ thuộc provider nhưng phải gồm nhóm:

- Secret API key.
- Webhook signing secret.
- Monthly/yearly price IDs.
- Environment/test-mode marker.

Validate env chỉ bắt buộc khi `billing_enabled=true`; staging và production dùng secret khác nhau.

## 12. Rollout/rollback

1. Provider sandbox + staging.
2. Billing flag false production, deploy webhook endpoint.
3. Verify signature/observability/reconcile.
4. Internal owner purchase/refund/cancel.
5. Limited rollout.
6. Public only after LP-14 gate.

Rollback: tắt checkout/billing flag; vẫn nhận và ghi webhook hợp lệ để subscription đã bán không lệch.
Không xóa billing events/subscriptions.
