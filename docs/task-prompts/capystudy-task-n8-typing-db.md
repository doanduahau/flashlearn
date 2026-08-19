# CapyStudy Task N8 — Typing mode DB foundation (bảng `typing_attempts` + `mode_answer_events` + RPC + coverage mode)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `2069f4a` (đã push, main đồng bộ origin/main, migration S1–S6 đã apply production)
- `Agent tier`: **DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc, task chạm DB)**
- `Commit message` (1 commit duy nhất): `feat: add typing attempt persistence and mode answer events`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Bối cảnh

User muốn thêm **chế độ kiểm tra thứ 3 "Nhập đáp án"** (typing) và **mọi chế độ kiểm tra (quiz + match + typing) đối xử như nhau**: tính câu sai, câu chưa làm, tỉ lệ chính xác chung. Điều này cần:

- `typing_attempts` + RPC ghi kết quả typing (giống match_attempts)
- **`mode_answer_events`** — bảng per-card đúng/sai của match + typing (để "câu sai" của quiz+match+typing gộp chung — mở rộng `loadWrongAnswerCardIds` ở Task N10; dashboard counts ở Task N14 tái dùng)
- Coverage mode `typing` (để "câu chưa làm" đối xử)

**Pattern chuẩn (đã có):** `match_attempts` + `save_match_attempt` (migration `20260816140000_match_attempts.sql`) — mirror cho typing_attempts.

## 2. Phạm vi task (chỉ làm đúng những mục này)

1. **Migration mới:** bảng `typing_attempts` + RPC `save_typing_attempt` + **bảng `mode_answer_events` + RPC `record_mode_answers`** (SECURITY DEFINER, service_role only)
2. **Mở rộng coverage:** thêm mode `typing` vào `learning_coverage_sessions` (nếu có check constraint mode) + `create_learning_coverage_session` chấp nhận mode `typing`
3. **pgTAP `033_typing_attempts.sql`** (cover cả 2 bảng + 2 RPC)
4. **Không làm:** UI, algorithm chấm điểm, ghi events từ match/typing session (Task N10/N14), mở rộng `loadWrongAnswerCardIds` (Task N10), thay đổi migration cũ

## 3. Thiết kế chi tiết

### 3.1. Bảng `typing_attempts` (mirror `match_attempts`)

```sql
create table public.typing_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_set_ids uuid[] not null default '{}',
  source_collection_ids uuid[] not null default '{}',
  source_all boolean not null default false,
  total_questions integer not null check (total_questions > 0),
  correct_questions integer not null check (correct_questions >= 0 and correct_questions <= total_questions),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);
```

- Index `idx_typing_attempts_user_completed on public.typing_attempts(user_id, completed_at desc)`
- RLS bật; policy `typing_attempts_select_own` (authenticated, user_id = auth.uid()); revoke/grant mirror match_attempts: `revoke all from public, anon, authenticated` → `grant select to authenticated` → `grant all to service_role`
- Không cần lưu từng câu (không snapshot — typing session chạy client-side, chỉ lưu tổng kết cuối, giống match)

### 3.2. RPC `save_typing_attempt` (pattern `save_match_attempt`)

Signature: `save_typing_attempt(p_user_id uuid, p_source_set_ids uuid[], p_source_collection_ids uuid[], p_source_all boolean, p_total_questions integer, p_correct_questions integer, p_elapsed_ms integer) returns uuid`

- SECURITY DEFINER + `set search_path = ''`
- Validation: `p_user_id` null → 42501 'authentication required'; `p_total_questions` null/≤0, `p_correct_questions` null/<0 hoặc > total, `p_elapsed_ms` null/<0, mảng chứa null phần tử → 22023 'invalid typing attempt'; coerce mảng null → `'{}'::uuid[]`, `p_source_all` null → false
- Insert với `started_at = now(), completed_at = now()` → return id
- Grants: `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role` (KHÔNG authenticated, KHÔNG anon)

### 3.3. Coverage mode `typing`

- Kiểm tra `learning_coverage_sessions` (migration chứa bảng — tìm "learning_coverage_sessions") có check constraint `mode in (...)` hay không
  - **Nếu có check:** thêm `'typing'` vào danh sách mode cho phép (additive migration — ALTER TABLE DROP CONSTRAINT + ADD CONSTRAINT mới, ghi rõ comment; hoặc nếu constraint tên cố định thì drop/add)
  - **Nếu không có check:** chỉ cần đảm bảo `create_learning_coverage_session` chấp nhận mode `typing` (nếu RPC không validate mode thì không cần đổi)
- KHÔNG đổi các RPC coverage khác

### 3.4. Bảng `mode_answer_events` + RPC `record_mode_answers` (per-card match/typing)

```sql
create table public.mode_answer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  mode text not null check (mode in ('match','typing')),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);
create index idx_mode_answer_events_user_card on public.mode_answer_events(user_id, flashcard_id, answered_at desc);
create index idx_mode_answer_events_user_completed on public.mode_answer_events(user_id, answered_at desc);
```

- RLS bật; policy `mode_answer_events_select_own` (authenticated, user_id = auth.uid()); revoke/grant mirror match_attempts (authenticated select-only, service_role all)
- RPC `record_mode_answers(p_user_id uuid, p_mode text, p_answers jsonb) returns void`:
  - `p_answers` = JSON array `[{ "flashcard_id": "<uuid>", "is_correct": true/false }]` — tối đa **200 phần tử**; phần tử sai format (uuid/boolean) → 22023
  - `p_mode` ∈ ('match','typing') — ngoài → 22023; `p_user_id` null → 42501
  - Loop insert từng phần tử (đúng user + mode + is_correct + answered_at now())
  - SECURITY DEFINER + `set search_path = ''`; grant service_role only (KHÔNG authenticated — client gọi qua admin server action)
  - Không verify ownership flashcard (thẻ user tự chơi; RLS ghi chặn, definer bypass — ghi comment)

### 3.5. pgTAP `033_typing_attempts.sql` (pattern `031_match_attempts.sql`)

Cover tối thiểu:

1. Boundary: `save_typing_attempt` + `record_mode_answers` SECURITY DEFINER + empty search_path; anon/authenticated KHÔNG execute; service_role execute
2. Bảng typing_attempts: RLS bật, policy select_own, revoke/grant đúng (authenticated select-only, service_role all)
3. Insert typing hợp lệ: trả id; row đúng user_id/counts/elapsed_ms/completed_at ≥ started_at
4. Validation typing: user null → 42501; total ≤ 0 / correct < 0 / correct > total / elapsed < 0 / null phần tử mảng → 22023; null array coerce
5. Bảng mode_answer_events: RLS bật, policy select_own, revoke/grant đúng
6. record_mode_answers: insert batch hợp lệ (đúng user/mode/is_correct); mode sai / format sai / >200 phần tử → 22023; user null → 42501
7. Isolation: user A không đọc được typing_attempts / mode_answer_events của B (RLS); authenticated đọc được row của mình
8. Coverage: tạo coverage session mode `typing` được (gọi `create_learning_coverage_session` với p_mode='typing' — assert không lỗi)

## 4. Verification gates (bắt buộc)

1. `npx supabase db reset` TRƯỚC `npm run db:test` (supabase test db không tự reset)
2. `npm run db:test`: 35 files PASS (thêm 033), assertions tăng
3. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
4. `git diff --check` sạch

## 5. Files dự kiến

- `supabase/migrations/20260816160000_typing_attempts.sql` (mới — 2 bảng + 2 RPC)
- `supabase/tests/033_typing_attempts.sql` (mới)
- KHÔNG đụng: migration cũ, UI, server actions, docs

## 6. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: RPC save_typing_attempt (ngắn) + phần coverage mode
Verification:
- npx supabase db reset: PASS/FAIL
- npm run db:test: N files / N assertions PASS (033 = N)
- npm run check: lint X errors / Y warnings, typecheck, unit N passed, build
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings (file:line) — BẮT BUỘC trước khi gửi
Safety: migrations YES (1 additive, đã reset+test) · DB YES · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ `20260816140000_match_attempts.sql` (pattern) + migration chứa `learning_coverage_sessions`
- Không tự ý thêm cột; nếu thiếu dữ liệu cần cho Task N10 (vd cần lưu từng câu để xem lại) thì ghi ambiguities thay vì tự quyết (thiết kế hiện tại: không lưu từng câu — giống match)
- Giữ nguyên mọi migration đã apply
