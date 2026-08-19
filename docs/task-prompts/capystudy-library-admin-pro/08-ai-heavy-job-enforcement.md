# LP-08 — AI credit, tài liệu nặng, concurrency và Typing batch

## 0. Metadata

- `Status`: planned
- `Difficulty`: 10/10 — tối quan trọng
- `Risk`: cost amplification, provider outage, partial failure, concurrency, untrusted files
- `Dependencies`: LP-01, LP-02, LP-07
- `Suggested commits`:
  - `feat: enforce ai and document usage quotas`
  - `refactor: batch semantic typing answer review`
- `Independent review`: bắt buộc; security + cost + failure semantics

## 1. Mục tiêu

Bịt toàn bộ đường gọi Gemini/document parser bằng quota/rate/concurrency/idempotency, giữ nguyên nguyên
tắc deterministic-first và không double-charge khi retry/failure.

## 2. AI call inventory

Bao gồm tối thiểu:

- Semantic Paste generation.
- Google Sheets semantic generation.
- Document section classification.
- DOCX/PDF prose/mixed generation.
- Typing semantic answer check.
- Mọi adapter mới dùng `GoogleGenAI` phải đi qua cùng accounting boundary.

Task phải có test/guard ngăn đường gọi provider trực tiếp bypass accounting trong các feature trên.

## 3. Logical job lifecycle

```text
validate/auth
  → rate limit
  → estimate and reserve quota
  → acquire per-user distributed concurrency slot
  → create/start processing job
  → deterministic parse/classification first
  → bounded provider calls only where required
  → validate/dedupe output
  → finalize actual usage or refund
  → release slot in finally
```

- Job và reservation dùng idempotency/correlation ID.
- Redis lock/semaphore có TTL, owner token và safe release.
- Durable DB job state là source cho support/reconcile; Redis không là source of truth.
- Provider call timeout/circuit breaker/retry policy vẫn bounded.

## 4. Quota và limits

- Áp dụng content credit formula, typing review, heavy monthly/daily, per-request, concurrency và physical call caps trong Program Spec.
- Free/Pro document limits khác nhau từ đầu client và lặp lại ở server boundary.
- Document analysis + generation dùng chung physical-call budget của logical job, không mỗi phase có một budget riêng.
- Retry attempt tương lai phải được accounting-aware; không âm thầm tăng `GEMINI_RETRY_ATTEMPTS`.

## 5. Typing redesign

Hiện trạng gọi AI tuần tự cho từng câu local sai có thể khuếch đại chi phí. Thiết kế mới:

- Local matcher chấm tất cả trước.
- Chỉ câu local sai và còn typing review quota mới vào batch.
- Batch có max items/chars, response schema map đúng stable item ID.
- Validate đủ/missing/duplicate item; malformed response fail closed về local result.
- Mỗi answer gửi AI debit một review unit, không dựa số HTTP call.
- Không gửi front nếu không cần; chỉ gửi user answer/correct answer tối thiểu.
- Provider failure giữ local wrong, không làm submit mất toàn bộ attempt.
- Nếu hết quota, UI/result giải thích “đã chấm theo quy tắc thông thường”, không ép upgrade giữa phiên.

## 6. File hardening

- Extension + MIME + magic bytes.
- DOCX/XLSX zip entry count, total uncompressed bytes, compression ratio.
- PDF page/object/text/decompression bounds và password rejection.
- Không thực thi macro/formula/embedded object.
- Timeout/memory limits có failure code.
- File invalid/malicious không trừ monthly success quota nhưng chịu rate-limit/burst protection.
- Không log filename/content.
- Không lưu file gốc.

## 7. Failure/charge policy

- Invalid trước provider: no debit.
- Deterministic output: no AI debit.
- Provider/platform failure không có usable result: refund AI reservation.
- Partial document có usable AI result: finalize actual phần đã dùng, UI báo partial.
- User cancel/close tab sau provider completion: usage vẫn finalize.
- Lock/Redis unavailable ở production: expensive operation fail closed với thông báo retry; learning local không bị hỏng.
- Reconciliation tìm stale reservation/running job và xử lý theo evidence, không đoán.

## 8. Observability và alert

- Metrics: source, plan, chars/pages, deterministic/AI sections/cards, provider calls/tokens, latency, refund, timeout, lock contention.
- Alert: provider error spike, reservation stuck, quota bypass mismatch, daily spend threshold, physical calls/job vượt expectation.
- Không gắn raw prompt/response vào Sentry.

## 9. Tests bắt buộc

- Structured Paste/document section không gọi AI và không debit.
- Semantic flow reserve/finalize đúng formula.
- Retry cùng idempotency không double call/debit.
- Concurrent job limit Free 1/Pro 2.
- Lock timeout/release/crash TTL.
- Combined classifier+generator physical cap.
- Provider timeout/malformed/partial/refund.
- Typing batch mapping, missing/duplicate result, quota exhausted, provider failure.
- Zip bomb/fake MIME/encrypted PDF/page/char/size boundaries.
- No content/token in captured logs.
- Existing document import E2E và typing E2E không regression.

## 10. Verification

- `npx supabase db reset`, `npm run db:test` nếu job/reservation RPC đổi.
- Unit/integration/fault tests.
- PDF runtime isolation/worker scripts hiện có.
- `npm run check` và full E2E.
- Load test staging với mock provider; không dùng Gemini thật trong automated tests.
- Independent review APPROVE.

## 11. Rollout/rollback

- Observe metrics trước khi block.
- Warn owner/test accounts trên staging.
- Spend cap provider và global circuit breaker trước production.
- Rollback enforcement bằng flag; giữ batch local matcher và file hardening nếu ổn định.
- Không bật Pro/billing khi LP-08 chưa verified.
