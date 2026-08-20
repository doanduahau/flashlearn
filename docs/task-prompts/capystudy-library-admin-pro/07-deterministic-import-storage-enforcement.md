# LP-07 — Storage quota, deterministic import và idempotency

## 0. Metadata

- `Status`: implementation complete; production migration applied in `observe` — enforcement rollout
  deferred pending second independent review, staging evidence, restore drill and owner approval
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

## 11. Implementation record (2026-08-19)

- One typed application source defines Free/Pro storage and per-request import limits.
- `flashcard_import_commits` makes logical imports idempotent per user; concurrent retries return the
  original set instead of creating duplicates.
- Statement-level database triggers plus an advisory lock protect set/card/collection totals against
  direct and concurrent growth. Card-side constraints enforce a 50,000-character hard ceiling.
- `legacy_storage_floors` captures existing usage without deleting, archiving or hiding old data.
- User-callable RPCs do not accept an enforcement-mode or user-id override. The database-owned
  `quota_runtime_settings` row is service-role-only; this prevents a browser caller from downgrading
  `block` to `observe`.
- Deterministic manual, CSV/XLSX, Google Sheets and structured Paste commits record `ai_used=false`
  and never reserve or debit AI quota.
- Manual/import, add/edit card, collection creation, shared clone, catalog install and starter
  provisioning all reach the common database guard. Deletes remain unrestricted by quota.
- Local verification covers pgTAP boundaries, legacy shrink/delete behavior, user isolation,
  observe/warn/block, and real concurrent final-slot/idempotent-import races.

The migration was applied to production on 2026-08-20 after the read-only preflight passed and remains
in `observe`. This is an observational deployment only, not approval to enable `warn` or `block`.
Remaining external rollout gates are tracked in `docs/PRODUCTION_DEFERRED_COSTS.md`.

## 12. Independent-review follow-up

The first independent review (`reports/LP07_INDEPENDENT_REVIEW_2026-08-19.md`) approved staging with
conditions and found no Critical/High issue. Its M1–M3 conditions are addressed as follows:

- Observe/warn now persist bounded would-block storage observations; warn surfaces an authenticated UI
  notice, while observe remains silent.
- The service-role-only database row is the sole storage mode for browser and service-role paths. Request
  GUC and environment drift cannot downgrade a storage mutation.
- `storage:preflight:production` performs an allowlisted, aggregate-only, read-only distribution and hard
  length check before migration.
- Regression coverage includes GUC downgrade, observation/status behavior, direct RLS growth, catalog,
  shared clone, starter provisioning, hard card-side length and fixed legacy-floor refill semantics.

Warn/block remain prohibited until the follow-up receives an independent re-review and all staging,
backup/restore and owner-approval gates are satisfied.

## 13. Current rollout record (2026-08-20)

- Production migration head is `20260819220000`; LP-07 schema is applied.
- Hardened production storage preflight passed: maximum card-side length `81`, card sides above the
  50,000-character hard ceiling `0`.
- Production `storage_enforcement_mode` remains `observe`.
- A production backup completed successfully before the deployment.
- The first independent review is `APPROVED WITH CONDITIONS`; M1–M3 have implementation and regression
  coverage in commit `0a57819` but still require a second independent reviewer.
- No repository record currently proves the full LP-07 pgTAP/concurrency/import/catalog/share suite ran
  against the dedicated staging project.
- Restore drill, measured RTO and explicit owner approval for `block` remain external gates. These are
  deliberately deferred rather than inferred or self-approved by the implementing agent.
