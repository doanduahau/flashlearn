# CapyStudy Task S6 — Stats RPC `get_set_members_with_stats` (thống kê giáo viên theo thành viên lớp học)

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `b4ee987` (đã push, main đồng bộ origin/main, migration S1/S3/S4/S5 đã apply production)
- `Agent tier`: **DeepSeek Flash (implementer) + Gemini (independent review — bắt buộc, task chạm DB)**
- `Commit message` (1 commit duy nhất): `feat: add classroom member stats RPC`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Bối cảnh

Phase Sharing gồm 7 task (S1–S7). Đã xong: S1 (share_token + classroom + memberships + 6 RPC), S2 (Share UI), S3 (preview public), S4 (clone + register membership), S5 (bảng `match_attempts` lưu kết quả Match). Task này (S6) xây **RPC thống kê** để giáo viên xem bảng xếp hạng học sinh trong "Chế độ lớp học". S7 (UI) sẽ dùng RPC này.

**Dữ liệu có sẵn:**

- `shared_set_memberships(set_id, member_user_id, clone_set_id, joined_at)` — unique(set_id, member_user_id); `clone_set_id` = bản sao bộ gốc trong tài khoản học sinh (S1 + grant service_role ở S4)
- `quiz_sessions` + `quiz_questions(flashcard_id, is_correct, answered_at, session_id)` — kết quả Trắc nghiệm (migration `20260806110000_add_quiz_engine.sql`)
- `match_attempts(user_id, source_set_ids uuid[], correct_pair_count, incorrect_attempt_count, elapsed_ms, completed_at)` — kết quả Match (S5)
- `profiles(display_name, avatar_url)` — thông tin người dùng

**Công thức thống kê đã chốt:**

- **Tổng câu đã làm** = (quiz: tổng câu đã trả lời) + (match: số cặp ghép đúng + số lần ghép sai)
- **Số câu đúng** = (quiz: câu đúng) + (match: số cặp ghép đúng) — **dùng để xếp hạng**
- **Tỉ lệ chính xác** = số câu đúng ÷ tổng câu đã làm — trả về **phần trăm 0–100, làm tròn 1 số thập phân** (vd 85.5 nghĩa là 85.5%)
- **Xếp hạng:** số câu đúng giảm dần → tổng câu đã làm giảm dần → tham gia sớm (joined_at asc); học sinh **chưa làm bài nào xếp cuối** (sau tất cả người có tổng > 0), trong nhóm chưa làm thì joined_at asc

**Phạm vi kết quả (đã chốt với user — phương án A):** chỉ tính kết quả **trên bộ clone** của từng học sinh:

- **Quiz:** chỉ câu hỏi đã trả lời thuộc thẻ của clone set — join `quiz_questions.flashcard_id → flashcards.set_id = clone_set_id`, và thuộc **bài đã hoàn thành** (join `quiz_sessions` có `completed_at is not null`)
- **Match:** chỉ phiên có clone set trong nguồn — `match_attempts.source_set_ids @> ARRAY[clone_set_id]` và `completed_at is not null`
- Kết quả từ bộ khác / phiên "Tất cả bộ" không khớp → không tính (giới hạn đã chốt, không sửa)

## 2. Phạm vi task (chỉ làm đúng những mục này)

1. **DB (1 migration mới):** RPC `get_set_members_with_stats(p_user_id, p_set_id)` + pgTAP `032_set_member_stats.sql`
2. **Không làm:** UI (S7), không sửa bảng/RPC nào khác, không sửa migration cũ, không đụng quiz/match/memory/runner/study/import/sharing UI

## 3. Thiết kế chi tiết

### 3.1. RPC `get_set_members_with_stats`

Signature:

```sql
create or replace function public.get_set_members_with_stats(
  p_user_id uuid,
  p_set_id uuid
)
returns table (
  rank integer,
  member_user_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  total_questions integer,
  correct_questions integer,
  accuracy numeric,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = ''
```

Semantics:

- **Owner-only:** `p_set_id` phải thuộc `p_user_id` (kiểm tra `public.flashcard_sets` có `id = p_set_id and user_id = p_user_id`) — không có → raise 42501 'not found or not owner' (generic, không lộ thông tin)
- `p_user_id` null → 42501 'authentication required'; `p_set_id` null → 22023
- Trả về **một hàng cho mỗi thành viên** của set (từ `shared_set_memberships` where `set_id = p_set_id`), kèm:
  - `display_name` / `avatar_url` từ `profiles` (left join — thành viên luôn có profile; nếu null thì trả null, không raise)
  - `joined_at` từ membership
  - `total_questions`, `correct_questions` tính theo công thức mục 1 (phạm vi clone set)
  - `accuracy` = `round(correct::numeric / nullif(total, 0) * 100, 1)` — null khi total = 0
  - `last_activity_at` = max(quiz completed_at gần nhất trong phạm vi, match completed_at gần nhất trong phạm vi) — null nếu chưa làm bài
- **Thứ tự trả về = thứ tự xếp hạng:** correct desc → total desc → joined_at asc; người chưa làm (total = 0) **luôn xếp sau** người có total > 0. `rank` = số thứ tự 1..N theo đúng thứ tự này (dense rank không cần — mỗi member 1 hàng, dùng row_number)

Implementation hints (đúng pattern dự án — tham khảo `get_shared_set_by_token` trong `20260816082928_set_sharing.sql`):

- Aggregate quiz per member trước (CTE/subquery): `select q.user_id, count(*) filter (where q.is_correct) as quiz_correct, count(*) as quiz_total, max(s.completed_at) as quiz_last from public.quiz_questions q join public.quiz_sessions s on s.id = q.session_id join public.flashcards f on f.id = q.flashcard_id join public.shared_set_memberships m on m.clone_set_id = f.set_id and m.member_user_id = q.user_id where m.set_id = p_set_id and s.completed_at is not null and q.is_correct is not null group by q.user_id` — lưu ý `flashcards.set_id = clone_set_id` (thẻ của clone set)
- Aggregate match per member: `select user_id, sum(correct_pair_count) as match_correct, sum(correct_pair_count + incorrect_attempt_count) as match_total, max(completed_at) as match_last from public.match_attempts where source_set_ids @> ARRAY[(select clone_set_id ...)] ...` — tính per membership (mỗi member có clone_set_id riêng)
- Gộp quiz + match theo member_user_id → total = quiz_total + match_total, correct = quiz_correct + match_correct
- JOIN với memberships + profiles, tính rank bằng `row_number() over (order by correct desc, total desc, joined_at asc)` — nhưng phải đảm bảo người total = 0 xếp sau: order by `(case when total > 0 then 0 else 1 end)` trước, rồi correct desc, total desc, joined_at asc

**Grants (pattern RPC đọc `get_shared_*`):**

```sql
revoke all on function public.get_set_members_with_stats(uuid, uuid) from public, anon;
grant execute on function public.get_set_members_with_stats(uuid, uuid) to authenticated;
grant execute on function public.get_set_members_with_stats(uuid, uuid) to service_role;
```

- **KHÔNG grant anon.** RLS không đổi (dữ liệu nhạy cảm — tên + điểm học sinh — chỉ owner lấy được qua RPC nhờ validate ownership)

### 3.2. pgTAP `032_set_member_stats.sql` (file mới, đúng pattern 029/030/031)

Cover tối thiểu:

1. Boundary: SECURITY DEFINER + empty search_path; anon KHÔNG execute; authenticated + service_role execute
2. Owner-only: user khác (không phải owner) gọi → 42501; set không tồn tại → 42501
3. Fixture: teacher T + 2 học sinh A, B (mỗi người có membership + clone set riêng); học sinh C chưa làm bài
4. Quiz: A trả lời 10 câu (8 đúng) trên clone set; 2 câu thuộc bộ khác của A → **không tính**; 1 bài quiz chưa completed → không tính
5. Match: A chơi match trên clone set: total_pairs 6, correct 5, incorrect 3 → match_total = 8, match_correct = 5; 1 phiên match "Tất cả bộ" (source_set_ids không chứa clone) → **không tính**
6. Kết quả A: total = 10 (quiz) + 8 (match) = 18; correct = 8 + 5 = 13; accuracy = round(13/18*100, 1) = 72.2
7. Rank: A (13 đúng) đứng trên B (ít đúng hơn); C (total = 0) xếp cuối; tie-break đúng + joined_at asc
8. `last_activity_at` = max quiz/match completed_at; null cho C
9. Không lộ dữ liệu: anon direct table read chặn (RLS giữ nguyên)

### 3.3. Không cần đổi TypeScript types trong task này

RPC mới sẽ được gọi từ S7 (UI) — types.ts có thể regen ở S7. KHÔNG cần sửa `src/lib/supabase/types.ts` trong task này (nếu agent regen thì cũng chấp nhận được nhưng không bắt buộc).

## 4. Verification gates (bắt buộc)

1. `npx supabase db reset` TRƯỚC `npm run db:test` (supabase test db không tự reset)
2. `npm run db:test`: 34 files PASS (thêm `032_set_member_stats.sql`), assertions tăng tương ứng
3. `npm run check`: lint 0 errors, typecheck clean, unit pass, build OK
4. `git diff --check` sạch

## 5. Files dự kiến thay đổi

- `supabase/migrations/20260816150000_set_member_stats.sql` (mới)
- `supabase/tests/032_set_member_stats.sql` (mới)

**KHÔNG đụng:** bất kỳ file nào khác, migration cũ, bảng/RPC hiện có.

## 6. Evidence report template (gửi về coordinator)

```text
Repository: start <baseline> → final <hash> (1 commit, N files, +X/−Y), push status: NOT pushed
Trích code: RPC get_set_members_with_stats (ngắn — signature + core query + grants)
Verification:
- npx supabase db reset: PASS/FAIL
- npm run db:test: N files / N assertions PASS (032 = N)
- npm run check: lint X errors / Y warnings, typecheck, unit N passed, build
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings (file:line) — BẮT BUỘC trước khi gửi
Safety: migrations YES (1 additive, đã reset+test) · DB YES · deps/env/AI/production NO
Ambiguities: <nếu có>
```

## 7. Lưu ý cho implementer

- Đọc kỹ `20260816082928_set_sharing.sql` (pattern RPC đọc + memberships) và `20260806110000_add_quiz_engine.sql` (quiz_sessions/quiz_questions) và `20260816140000_match_attempts.sql` (match_attempts)
- **Chính xác nhất:** quiz tính qua `quiz_questions.flashcard_id → flashcards.set_id = clone_set_id` (per-card, không phụ thuộc source_set_ids của quiz session); match tính qua `source_set_ids @> ARRAY[clone_set_id]` (match không có per-card data)
- accuracy là **phần trăm 0–100** làm tròn 1 số thập phân (72.2 = 72.2%); null khi total = 0
- Người chưa làm bài total = 0 → accuracy null, last_activity_at null, rank xếp cuối
- Không tự ý thêm cột/đổi công thức; nếu thiếu dữ liệu cần thiết cho S7 thì ghi trong ambiguities thay vì tự quyết
