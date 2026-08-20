# LP-12 — Downgrade, grace period và subscription lifecycle

## 0. Metadata

- `Status`: planned
- `Difficulty`: 8/10 — cao
- `Risk`: high; time boundaries, entitlement transitions và không được mất data
- `Dependencies`: LP-02, LP-11
- `Suggested commit`: `feat: implement safe subscription downgrade lifecycle`
- `Independent review`: bắt buộc

## 1. Mục tiêu

Triển khai state machine và effective entitlement khi Pro hủy/hết hạn/past due, dùng manual fixtures
trước billing provider. Bảo đảm user không bị mất hoặc khóa dữ liệu cũ bất ngờ.

## 2. State machine

Áp dụng state trong Program Spec:

- Free default.
- Pro active.
- Cancel at period end vẫn Pro đến kỳ cuối.
- Past due có policy tạm thời, không xóa data.
- Grace 14 ngày.
- Expired resolve Free.

Transition phải idempotent, monotonic theo event time/provider precedence phù hợp; event cũ đến sau
không được làm sống lại/hủy subscription sai.

## 3. Time semantics

- Lưu UTC.
- Period start/end theo provider/subscription anchor.
- Annual tạo monthly quota windows synthetic/deterministic.
- UI convert timezone người dùng.
- Test DST/timezone, exact boundary, leap date khi liên quan.
- Không dùng client clock làm authorization.

## 4. Overage behavior

Sau grace khi resolve Free:

- Read/study/quiz/export/delete/rename vẫn dùng được.
- Edit được phép nếu không tăng usage vượt current effective floor.
- Tạo/import/clone/install bị chặn nếu tăng overage.
- Existing link/classroom không bị xóa; block tạo mới/tăng membership vượt cap.
- AI/heavy quota dùng Free window.
- Re-upgrade khôi phục Pro ngay, không cần restore data.
- User delete xuống dưới cap thì creation tự mở lại.

## 5. Legacy migration

- Snapshot current usage trước `block` rollout.
- Tài khoản vượt Free có legacy floor/override rõ expiry/chính sách đã duyệt.
- Không dùng grandfather để tự cấp Pro feature ngoài storage.
- Reconciliation report cho account overage/floor mismatch.

## 6. Notifications

- 7 ngày trước hết hạn nếu có scheduled cancel.
- Ngày bắt đầu grace.
- Trước grace end.
- Sau chuyển Free, giải thích dữ liệu vẫn an toàn và action khả dụng.
- Notification idempotent; không spam khi webhook lặp.
- Email/push copy và actual sending chỉ làm nếu hạ tầng hiện có phù hợp; UI notification là bắt buộc.

## 7. Ngoài phạm vi

- Không checkout/payment/refund.
- Không trial tự động.
- Không dunning logic provider-specific.
- Không tự tắt/xóa existing share links.

## 8. Tests bắt buộc

- Mọi state transition hợp lệ/không hợp lệ/idempotent/out-of-order.
- Cancel at end giữ Pro đúng thời gian.
- Grace đúng 14 ngày.
- Annual monthly quota windows.
- Overage read/edit-no-growth/delete vs create/import.
- Existing links/classes preserved.
- Re-upgrade immediate.
- Legacy floor.
- Notifications dedupe và timezone display.

## 9. Verification và rollout

- DB/unit/integration/E2E với fake clock.
- `npx supabase db reset`, `npm run db:test` nếu RPC/state schema đổi.
- `npm run check`, `git diff --check`.
- Staging time-travel fixtures; independent review.
- Rollout observe/warn trước block; rollback entitlement resolver về prior state, không mutate/delete data.
