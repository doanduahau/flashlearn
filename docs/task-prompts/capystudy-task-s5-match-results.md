# CapyStudy Task S5 — Match persistence (bảng `match_attempts` + luồng hoàn thành Match lưu kết quả)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `0719c92` (đã push, main đồng bộ origin/main, migration S1/S3/S4 đã apply production)
- `Agent tier`: **DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc, task chạm DB)**
- `Commit message` (1 commit duy nhất): `feat: persist match results for classroom stats`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Bối cảnh

Phase Sharing gồm 7 task (S1–S7). S1–S4 đã xong (share link + classroom mode + preview + clone). S6 sẽ xây stats RPC `get_set_members_with_stats` gộp kết quả **Trắc nghiệm (`quiz_sessions`) + Match (`match_attempts`)** để giáo viên xem bảng xếp hạng học sinh trong "Chế độ lớp học".

**Hiện trạng:** Match (trang kiểm tra → chế độ Match) **không lưu kết quả** — chỉ lưu coverage session (`learning_coverage_sessions` qua `completeLearningCoverageSession`). Muốn tính điểm Match cho học sinh, cần bảng `match_attempts` + luồng hoàn thành Match ghi kết quả.

**Công thức thống kê đã chốt (dùng cho S6, S5 chỉ cần lưu đủ số liệu):**

- **Tổng câu đã làm** (của 1 học sinh) = (quiz: tổng câu đã trả lời) + (match: số cặp ghép đúng + số lần ghép sai)
- **Số câu đúng** = (quiz: câu đúng) + (match: số cặp ghép đúng) — **dùng để xếp hạng**
- **Tỉ lệ chính xác** = số câu đúng ÷ tổng câu đã làm (làm tròn 1 số thập phân)

→ `match_attempts` phải lưu được: **số cặp ghép đúng** và **số lần ghép sai** (tách riêng 2 cột), kèm thời gian và nguồn.

## 2. Phạm vi task (chỉ làm đúng những mục này)

1. **DB (1 migration mới):** bảng `match_attempts` + RPC `save_match_attempt` (SECURITY DEFINER, service_role only) + pgTAP `031_match_attempts.sql`
2. **Match state:** thêm đếm số lần ghép sai vào `match-state.ts`
3. **MatchBoard:** truyền số liệu (số cặp đúng + số lần sai) lên `onComplete`
4. **MatchSession:** đo thời gian chơi (elapsed_ms) từ lúc bắt đầu → hoàn thành; khi hoàn thành → gọi coverage complete (giữ nguyên) + lưu match_attempts
5. **Không làm:** stats UI (S7), stats RPC (S6), bất kỳ thay đổi nào với quiz/memory/runner/study/import

## 3. Thiết kế chi tiết

### 3.1. Bảng `match_attempts` (migration mới, mirror `quiz_sessions`)

```sql
create table public.match_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_set_ids uuid[] not null default '{}',
  source_collection_ids uuid[] not null default '{}',
  source_all boolean not null default false,
  total_pairs integer not null check (total_pairs > 0),
  correct_pair_count integer not null check (correct_pair_count >= 0 and correct_pair_count <= total_pairs),
  incorrect_attempt_count integer not null check (incorrect_attempt_count >= 0),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);
```

- Index: `idx_match_attempts_user_completed on public.match_attempts(user_id, completed_at desc)`
- RLS bật; policy `match_attempts_select_own` cho authenticated (user_id = auth.uid()); revoke/grant giống hệt `quiz_sessions` (xem migration `20260806110000_add_quiz_engine.sql`): `revoke all from public, anon, authenticated` → `grant select to authenticated` → `grant all to service_role`
- `total_pairs` = tổng số cặp của phiên (questionCount của Match); `correct_pair_count` = số cặp ghép đúng; `incorrect_attempt_count` = tổng số lần người dùng ghép sai (mỗi lần chọn 2 thẻ sai = 1 lần sai)

### 3.2. RPC `save_match_attempt` (SECURITY DEFINER, service_role only — pattern `clone_shared_set` S4)

Signature: `save_match_attempt(p_user_id uuid, p_source_set_ids uuid[], p_source_collection_ids uuid[], p_source_all boolean, p_total_pairs integer, p_correct_pair_count integer, p_incorrect_attempt_count integer, p_elapsed_ms integer) returns uuid`

Validation (đúng pattern dự án, `set search_path = ''`):

- `p_user_id` null → raise 42501 'authentication required'
- `p_total_pairs` ≤ 0 hoặc `p_correct_pair_count` < 0 hoặc `p_correct_pair_count` > `p_total_pairs` hoặc `p_incorrect_attempt_count` < 0 hoặc `p_elapsed_ms` < 0 → raise 22023 'invalid match attempt'
- `p_source_set_ids`/`p_source_collection_ids` null → coerce `'{}'::uuid[]`; không chứa null phần tử
- Không cần validate ownership nguồn (người chơi chỉ chơi trên thẻ của mình; RLS không mở ghi)

Body: insert `match_attempts` (started_at/completed_at = now()) → return id. Đây là ghi kết quả cuối phiên — KHÔNG gộp với coverage session (coverage giữ nguyên riêng).

Grants: `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role` (KHÔNG authenticated, KHÔNG anon — client gọi qua `createAdminClient`).

### 3.3. Match state — đếm số lần ghép sai

`src/features/match/utils/match-state.ts`:

- Thêm `incorrectAttemptCount: number` vào `MatchState` (init 0 trong `createMatchState`; `advanceBatch` và `buildReplay` giữ nguyên giá trị — đếm toàn phiên, không reset theo batch)
- Trong `resolvePair`, khi `isCorrect === false` → `state.incorrectAttemptCount = state.incorrectAttemptCount + 1`
- Export helper đọc `incorrectAttemptCount` (vd `incorrectAttemptCountOf(state)` hoặc đọc trực tiếp field — chọn 1, nhất quán với `completedCount`)
- KHÔNG đổi hành vi chấp nhận cặp 2 chiều, advance batch, matched sets, lastResult (đã hoạt động từ Task 8c)

### 3.4. MatchBoard — truyền số liệu lên

`src/features/match/components/match-board.tsx`:

- Đổi signature `onComplete: (stats: { correctPairs: number; incorrectAttempts: number }) => Promise<void>` (hoặc object riêng — chọn 1 kiểu rõ ràng)
- Khi phase completed → gọi `onComplete({ correctPairs: state.completedPairCount, incorrectAttempts: state.incorrectAttemptCount })`
- KHÔNG đổi layout 12 ô cố định, thông báo h-8, selectors E2E (`data-match-card-id`, `data-match-side`)

### 3.5. MatchSession — đo thời gian + lưu kết quả

`src/features/match/components/match-session.tsx`:

- Đo elapsed: lưu `startedAtRef = useRef(Date.now())` khi session load xong (effect đầu tiên) — hoặc tương đương; khi hoàn thành `elapsed_ms = Date.now() - startedAt`
- `handleComplete`: giữ nguyên bước 1 `completeLearningCoverageSession(session.coverageSessionId)` (lỗi → setError, không lưu match) → bước 2 gọi server action `saveMatchAttempt` (mới) với source (từ `sourceFromHref` đã có) + totalPairs (questionCount) + stats từ onComplete + elapsed
- **Chống double-submit:** guard ref `completingRef` (pattern Task 5 runner) — nếu đang xử lý thì bỏ qua; cả 2 bước đều trong guard
- Lỗi bước 2 (lưu match fail) → hiện error nhỏ nhưng KHÔNG chặn màn hoàn thành (coverage đã xong — đúng pattern Task 5 runner: retry phân biệt). Có nút "Thử lại" cho riêng bước lưu match nếu lỗi (giữ UX đơn giản)
- `replay()` reset `startedAtRef`

### 3.6. Server action mới

`src/features/match/server/actions.ts` — thêm `saveMatchAttempt(input)` (hoặc file mới trong feature — chọn theo cấu trúc hiện có):

- Zod schema validate: `sourceSetIds: uuid[]`, `sourceCollectionIds: uuid[]`, `sourceAll: boolean`, `totalPairs: int > 0`, `correctPairs: int >= 0`, `incorrectAttempts: int >= 0`, `elapsedMs: int >= 0` (+ ràng buộc correctPairs ≤ totalPairs)
- Auth: `getClaims` (pattern các action khác trong file) → user_id
- Gọi `createAdminClient().rpc("save_match_attempt", { p_user_id, ... })` → lỗi → trả `{ ok: false, error: "Không thể lưu kết quả lúc này." }` (generic tiếng Việt)
- `ok: true` → không cần revalidate (không ảnh hưởng UI hiện tại)

## 4. Verification gates (bắt buộc)

1. `npx supabase db reset` TRƯỚC `npm run db:test` (supabase test db không tự reset) — migration chain chạy sạch từ DB trống
2. `npm run db:test`: 33 files PASS (thêm `031_match_attempts.sql`), assertions tăng tương ứng
3. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
4. Chạy lại test Match hiện có: `npx vitest run tests/unit/features/match` — tất cả pass (đặc biệt `match-state.test.ts`, `match-session.test.tsx`)
5. E2E liên quan (chạy qua `npm run test:e2e`): match spec + quiz-advancement (nếu chạm) — pass
6. `git diff --check` sạch

## 5. pgTAP `031_match_attempts.sql` (file mới, đúng pattern 029/030)

Cover tối thiểu:

1. Boundary: `save_match_attempt` là SECURITY DEFINER + empty search_path; authenticated/anon KHÔNG execute; service_role execute
2. Bảng: RLS bật, policy select_own đúng; revoke/grant đúng (authenticated chỉ select, service_role all)
3. Insert hợp lệ: trả id; row đúng user_id + counts + elapsed_ms + completed_at >= started_at
4. Validation: user null → 42501; total_pairs = 0 → 22023; correct > total → 22023; incorrect < 0 → 22023; elapsed < 0 → 22023; mảng null → coerce '{}'
5. Isolation: user A không đọc được match_attempts của B qua RLS (direct table read chặn); authenticated đọc được row của mình

## 6. Files dự kiến thay đổi

- `supabase/migrations/20260816140000_match_attempts.sql` (mới)
- `supabase/tests/031_match_attempts.sql` (mới)
- `src/features/match/utils/match-state.ts` (sửa — thêm incorrectAttemptCount)
- `src/features/match/components/match-board.tsx` (sửa — onComplete stats)
- `src/features/match/components/match-session.tsx` (sửa — elapsed + save)
- `src/features/match/server/actions.ts` (sửa — saveMatchAttempt + schema)
- `tests/unit/features/match/match-state.test.ts` (sửa — test đếm sai)
- `tests/unit/features/match/match-session.test.tsx` (sửa — test lưu kết quả)
- `src/lib/supabase/types.ts` (regen — nếu cần)

**KHÔNG đụng:** quiz/memory/runner/study/import/sharing S1–S4 files ngoài danh sách trên, migration cũ (KHÔNG sửa `20260816082928_set_sharing.sql` hay bất kỳ migration đã apply), docs.

## 7. Evidence report template (gửi về coordinator)

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: RPC save_match_attempt (ngắn), match-state incorrectAttemptCount, handleComplete mới
Verification:
- npx supabase db reset: PASS/FAIL
- npm run db:test: N files / N assertions PASS (031 = N)
- npm run check: lint X errors / Y warnings, typecheck, unit N passed, build
- npx vitest run tests/unit/features/match: N passed
- E2E <specs>: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings (file:line) — BẮT BUỘC trước khi gửi
Safety: migrations YES (1 additive, đã reset+test) · DB YES · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 8. Lưu ý cho implementer

- Đọc kỹ pattern migration `20260806110000_add_quiz_engine.sql` (bảng kết quả + RLS + grant) và `20260816130000_clone_shared_set.sql` (RPC service_role only)
- Không tự ý thêm cột/field ngoài thiết kế; nếu thiếu dữ liệu cần thiết cho S6 thì ghi trong ambiguities thay vì tự quyết
- `incorrectAttemptCount` đếm TOÀN phiên (không reset theo batch) — mỗi lần ghép sai = +1
- Giữ nguyên toàn bộ hành vi Match hiện tại (chấp nhận cặp 2 chiều, 12 ô cố định, thông báo h-8, pause tab ẩn, exit confirm)
