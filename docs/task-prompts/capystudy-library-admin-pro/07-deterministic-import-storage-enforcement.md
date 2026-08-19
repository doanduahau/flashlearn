# LP-07 — Storage quota, deterministic import và idempotency

## 0. Metadata

- `Status`: planned
- `Difficulty`: 9/10 — rất cao
- `Risk`: critical; nhiều mutation path, legacy data, concurrent growth và duplicate import
- `Dependencies`: LP-02
- `Suggested commit`: `feat: enforce storage and deterministic import entitlements`
- `Independent review`: bắt buộc

## 1. Mục tiêu

Áp dụng plan limits cho mọi đường làm tăng set/card/text storage và import deterministic, đồng thời
không trừ AI credit cho parser chắc chắn.

## 2. Mutation inventory bắt buộc

Rà và gate ít nhất:

- Manual set creation.
- Atomic CSV/XLSX import.
- Google Sheets structured import.
- Structured Paste import.
- Add card.
- Clone shared set.
- Install catalog set.
- Reinstall catalog.
- Bất kỳ RPC/batch path nào insert `flashcard_sets`/`flashcards`.
- Edit card làm tăng tổng text usage khi account đang vượt cap.

Không chỉ gate UI/server action; database/trusted mutation boundary phải bảo vệ race.

## 3. Plan-specific limits

Áp dụng đúng Program Spec:

- Free 20 sets/3.000 cards/10 collections.
- Pro 200/30.000/100.
- Manual/CSV/XLSX/Sheets/structured Paste per-request caps.
- Soft card side chars Free/Pro, hard DB ceiling 50.000.
- Deterministic import không monthly quota và không AI credit.

Constants phải có một typed entitlement source; không copy số ở nhiều UI/server file. SQL hard caps được
document là defense-in-depth và có drift test/contract test.

## 4. Import idempotency

- Client sinh idempotency key cho logical commit.
- Server schema validate key.
- RPC/DB unique constraint đảm bảo cùng user+key không tạo hai set.
- Retry trả `set_id`/count cũ.
- Key không được cho phép user truy cập result của user khác.
- Không dùng content hash đơn thuần làm idempotency vì user có thể chủ động import hai bộ giống nhau.

## 5. Storage accounting

- Count sets/cards từ source of truth hoặc maintained counter atomic được chứng minh đúng.
- Nếu dùng projection/counter, có reconciliation query/script.
- Text growth tính delta normalized; edit không tăng usage được phép khi legacy overage.
- Delete luôn được phép và giải phóng usage.
- Starter/catalog cards tính vào tổng.
- Không lưu file gốc; filename metadata không tính như file storage.

## 6. Legacy rollout

- Observe để chụp current set/card/text usage.
- Tạo `legacy_storage_floor`/override cho account vượt Free trước ngày enforcement.
- Không tự chuyển/xóa/archive data.
- UI warn trước block.
- Existing share/classroom links không tự tắt vì storage rollout.

## 7. Error contract

Phân biệt:

- `quota_exceeded` kèm key/current/limit/reset nếu có.
- `per_request_limit`.
- `rate_limited`.
- `conflict`/idempotent replay.
- `unexpected` generic.

Không trả SQL/provider detail. Form/draft được giữ để user giảm kích thước hoặc upgrade.

## 8. Tests bắt buộc

- Unit entitlement mapping cho từng source/plan.
- Structured Paste chứng minh `aiUsed=false` và 0 AI debit.
- Boundary: 499/500/501 và 1.999/2.000/2.001.
- Set/card/collection caps.
- Concurrent import/add card không vượt tổng cap.
- Idempotent retry trả same set.
- Edit legacy không tăng được nhưng giảm được; delete luôn được.
- Clone shared/catalog đều gate.
- User không forge plan hoặc user_id.
- Observe/warn/block modes.

## 9. Verification

- `npx supabase db reset`, `npm run db:test`.
- Unit/integration import tests.
- E2E Free boundary và Pro fixture/override.
- `npm run check`, full relevant E2E, `git diff --check`.
- Independent DB/security review.

## 10. Rollout/rollback

1. Observe production tối thiểu một chu kỳ phù hợp hoặc đủ sample.
2. Warn với UI progress.
3. Chụp legacy floor.
4. Block internal users/staging.
5. Progressive production.

Rollback bằng `quota_enforcement_mode=warn|observe`; không rollback ledger/data.
