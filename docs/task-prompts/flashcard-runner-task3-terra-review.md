# Flashcard Runner V1 — Task 3: independent security/architecture review (Terra)

> **Status:** verified (2026-08-14) — Terra: **APPROVE WITH COMMENTS**; controller spot-check khớp (A1/A3/A5/Finding#1)
> **Triage:** Finding #1 (double-click tạo 2 session) — xác nhận đúng nhưng cùng pattern Match/Memory, không ảnh hưởng integrity (coverage chỉ commit khi hoàn thành). **Deferred** — không chặn Task 4; ghi nhận làm ứng viên harden chung start-flow sau này
> **Baseline commit:** `3137b33` (`feat: add runner setup and session wiring`)
> **Agent tier:** Codex + GPT-5.6 Terra — **independent reviewer, read-only**
> **Vai trò:** review độc lập Task 3 (server wiring + setup). KHÔNG được sửa code/test/migration/docs/env. Chỉ trả findings report.

---

## 0. Role và ground rules

Bạn là reviewer độc lập. Bắt buộc:

- **Read-only tuyệt đối:** không sửa bất kỳ file nào, không tạo migration, không chạm env/production, không push, không commit.
- Base: `3137b33`. Chạy `git status` / `git log -3` để xác nhận.
- Đọc để hiểu **ý định** của task: `docs/task-prompts/flashcard-runner-task3-server-setup.md` (prompt gốc) — đối chiếu implementation với ý định.
- Mọi nhận định phải kèm **evidence (file:line)**. Không suy đoán không nguồn.

## 1. Files cần đọc

Implementation Task 3:

- `src/features/runner/server/actions.ts` (trọng tâm)
- `src/features/runner/schemas/runner-schema.ts`
- `src/features/runner/utils/runner-session.ts`, `utils/map-runner-session-payload.ts`
- `src/app/(app)/runner/page.tsx`, `src/app/(app)/runner/session/page.tsx`
- `src/features/runner/components/runner-setup.tsx`, `components/difficulty-selector.tsx`

DB contracts (source of truth):

- `supabase/migrations/20260813020000_add_runner_database_foundation.sql`
- `supabase/migrations/20260812190000_add_learning_coverage.sql` +
  `20260812200000_make_learning_coverage_session_safe.sql` (coverage creation/RLS/advisory lock)
- `supabase/tests/026_runner_sessions.sql`, `027_runner_personal_bests.sql`

Pattern precedents để so sánh:

- `src/features/match/server/actions.ts`, `src/features/memory/server/actions.ts`
- `src/features/practice-coverage/server/actions.ts`
- `src/lib/supabase/admin.ts`, `server.ts`

## 2. Focus areas — trả lời TỪNG mục một cách tường minh

### A. Service-role boundary

1. `create_runner_session` có phải là **đường duy nhất** tạo `runner_sessions` + coverage (mode 'runner') không? Kiểm tra grants: ai được execute RPC này? (phải là `service_role` only).
2. Trong code, RPC này chỉ được gọi qua `createAdminClient()` với `p_user_id` lấy từ server claims — xác nhận không có path nào khác (browser RPC/table write) tạo runner session.
3. Kiểm tra RLS + revoke trên `runner_sessions` (SELECT only cho authenticated) và `runner_personal_bests` (SELECT only) — có lỗ hổng ghi trực tiếp không?
4. Có chỗ nào client gửi `user_id` / `difficulty` / `session_card_ids` được RPC tin tưởng mà không qua validation server không?

### B. Ownership và cô lập giữa các user

5. `loadCards`: ownership check cho sets/collections (in id + length) có đủ không? Query flashcards dựa vào RLS — RLS có thực sự chặn cross-user không (kiểm tra policy trong migration core)?
6. Session page: user A truy cập `/runner/session?sessionId=<session của B>` — bị chặn ở đâu (RLS `select_own` trên `runner_sessions` + `load_runner_session_questions` scoped theo `auth.uid()`)? Xác nhận bằng evidence.
7. `create_runner_session` tự validate ownership từng thẻ + composite FK `(user_id, coverage_session_id)` + trigger `validate_runner_session_coverage` — đủ để chặn cross-user coverage không?

### C. Input validation / trust boundaries

8. `runnerStartSchema`: count ∈ {12,18,24}, filter enum, difficulty enum, UUID arrays ≤ 50, 3 rule superRefine — có lỗ hổng nào tới được DB không đúng ý định?
9. Session page: `sessionId` không qua zod-uuid trước query — path lỗi PostgREST có an toàn (redirect, không crash, không leak) không? `difficulty` được check enum trước khi dùng chưa?
10. `mapRunnerSessionRows`: schema boundary có đủ chặt (3 choices, correctAnswer ∈ choices) — có đường nào RPC output xấu tới client không?
11. Error handling: mọi catch → message generic tiếng Việt, không lộ SQL/stack — kiểm tra từng action.

### D. Concurrency / atomicity / idempotency

12. `create_runner_session` có atomic (coverage creation + insert runner_sessions trong cùng transaction security definer) không? Advisory lock ở coverage creation còn hiệu lực cho path này?
13. Double-click "Bắt đầu Runner" → 2 session được tạo — so với Match/Memory có giống nhau không (chấp nhận được)? Có nên flag là minor observation không?

### E. Bộ lọc eligibility tạm thời

14. `filterByEligibility` (server) có khớp **chính xác** với check nội bộ của `create_runner_session` không (cùng normalization `lower(regexp_replace(btrim(back)...))`, cùng count distinct ≥ 2)? Nếu lệch → session fail với generic error (UX). Chỉ ra sự khác biệt nếu có.

### F. Rủi ro tương lai (chỉ ghi nhận, không hành động)

15. Nhân đôi lần 3 của `loadCards`/`filterCardsByMode` (match/memory/runner) — mức độ rủi ro.
16. Có gì chặn Task 4 (session page thay bằng game thật) hoặc Task 5 (`submit_runner_best_time`) không?

## 3. Deliverable — trả về report

```text
## Findings
| # | Severity (blocker|major|minor|nit) | file:line | Vấn đề | Ảnh hưởng | Đề xuất sửa |

## Answers A1–A16
(trả lời từng mục với evidence ngắn gọn)

## Verdict
APPROVE | APPROVE WITH COMMENTS | CHANGES REQUIRED
(kèm lý do 1–3 dòng)
```

- Nếu phát hiện **blocker/major**: mô tả chính xác cách sửa tối thiểu nhưng **KHÔNG áp dụng**.
- Không cần chạy E2E (cần local Supabase). Được phép chạy `npx tsc --noEmit` / eslint nếu thấy hữu ích (read-only).

## 4. Safety

- Code changed: NO · DB changed: NO · deps changed: NO · env changed: NO · production accessed: NO · push/commit: NO
