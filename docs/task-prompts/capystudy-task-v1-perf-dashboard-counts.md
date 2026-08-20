# CapyStudy Task V1 — Tối ưu tốc độ: gộp query dashboard + mở phiên quiz bằng RPC

## 0. Metadata

- `Status`: draft → reviewed → delivered → verified
- `Baseline commit`: `27b6f60` (đã push, main đồng bộ origin/main)
- `Agent tier`: DeepSeek Flash (implementer) + Gemini (independent review — BẮT BUỘC vì chạm DB)
- `Commit message`: `perf: consolidate dashboard and quiz-setup counts into RPCs`
- `Push`: KHÔNG push — gửi evidence report; chỉ push sau khi coordinator verify + user duyệt

## 1. Yêu cầu (từ user)

> "Chuyển qua lại các trang (đặc biệt vào trang tổng quan) khá chậm mới load; lúc tính toán số lượng câu hỏi, mở phiên, bắt đầu cũng chậm. Tối ưu để nhanh và mượt hơn."

## 2. Chẩn đoán đã xác nhận (đọc code trước khi làm)

1. **Streak bị query lặp 6 lần mỗi lần vào /dashboard**:
   - `loadMascotLevel` gọi `loadStreakSummary` (2 queries: profiles.timezone + daily_learning_records)
   - `dashboard/page.tsx` gọi thẳng `loadStreakSummary` (2 queries nữa)
   - `src/app/(app)/layout.tsx` (AppShell) gọi `loadStreakSummary` lần 3 (2 queries) — chạy trên MỌI trang authenticated
2. **Dashboard: chuỗi "Cần ôn / Chưa học" = hàng chục queries**:
   - `collectStudyCardIds({all:true})` (1 query) → `loadWrongAnswerCardIds` (chunk 200 ids × 2 bảng quiz_questions + mode_answer_events, phân trang 1000/dòng) + `loadUntouchedCardCount` (chunk 200 ids × 3 bảng mode_answer_events + quiz_questions + card_review_events)
   - Với 2000 thẻ ≈ 30–60 queries chỉ để hiện 2 con số
3. **`startQuiz` / `getQuizEligibility`** (mở phiên kiểm tra) chạy lại đúng chuỗi nặng đó (loadUncoveredIds chunk + loadWrongAnswerCardIds chunk/paginate)
4. **`loadMonthlyStreakDates`** và `loadStreakSummary` mỗi hàm load toàn bộ `daily_learning_records.local_date` — 2 lần load cùng 1 dữ liệu

## 3. Phạm vi task

1. **Migration + 2 RPC** (1 file migration mới + pgTAP):
   - `get_dashboard_counts()` → `table(due_count integer, untouched_count integer)` — dùng `auth.uid()` nội bộ, KHÔNG nhận p_user_id (RSC gọi bằng session user — an toàn hơn, không spoof được)
   - `get_quiz_scope_sets(p_set_ids uuid[], p_collection_ids uuid[], p_all boolean)` → `table(total integer, uncovered_ids uuid[], wrong_ids uuid[])` — dùng `auth.uid()`
2. **Dedupe streak bằng React `cache()`** — 1 lần load/request cho layout + dashboard + mascot
3. **Dedupe load dates** — `loadStreakSummary` và `loadMonthlyStreakDates` dùng chung 1 loader được cache
4. **Dashboard dùng RPC** thay chuỗi query cũ; **quiz setup + startQuiz dùng RPC** thay chunk/paginate
5. Unit test + pgTAP + E2E regression

KHÔNG làm: đổi thuật toán chọn thẻ (selectCardsByPriority giữ nguyên), đổi contract server action public, view transitions (task V3), loading skeleton (task V2).

## 4. Thiết kế chi tiết

### 4.1. Migration `get_dashboard_counts()`

- `language sql stable security invoker set search_path = ''` — giống `get_due_review_card_count` (đã có), KHÔNG cần DEFINER (chạy bằng session user, RLS tự giới hạn)
- `due_count`: **sao chép y hệt body của `get_due_review_card_count(p_user_id)`** nhưng thay `p_user_id` bằng `auth.uid()` (latest answer per card gộp quiz_questions [join quiz_sessions, completed_at not null] + mode_answer_events, is_correct=false)
- `untouched_count`: **mirror y hệt `loadUntouchedCardCount`** — đếm flashcards của user KHÔNG có trong:
  - `mode_answer_events` (flashcard_id = f.id)
  - `quiz_questions` có `answered_at not null` (join quiz_sessions có `completed_at not null`)
  - `card_review_events`
  - KHÔNG dùng flashcard_coverage (giữ nguyên hành vi hiện tại: thẻ xuất hiện trong session nhưng chưa trả lời vẫn tính "chưa học")
- Grants: `revoke all from public, anon; grant execute to authenticated, service_role;` (mirror `get_learning_statistics` — dashboard gọi bằng session user)
- KHÔNG thay đổi `get_due_review_card_count` cũ (edge function W3 đang dùng)

### 4.2. Migration `get_quiz_scope_sets(p_set_ids, p_collection_ids, p_all)`

- `language sql stable security invoker set search_path = ''`
- Resolve scope bằng `auth.uid()`:
  - `p_all = true` → tất cả flashcards của user
  - ngược lại: flashcards `set_id = any(p_set_ids)` UNION flashcards qua `special_collection_items` (`collection_id = any(p_collection_ids)`) — dedupe theo flashcard_id
- `total`: số thẻ dedupe
- `uncovered_ids`: thẻ trong scope KHÔNG có trong `flashcard_coverage` (mode = 'quiz') — mirror `loadUncoveredIds("quiz", ids)`
- `wrong_ids`: thẻ có latest answer sai — mirror `loadWrongAnswerCardIds` (quiz_questions + mode_answer_events, sort answered_at desc, id desc, is_correct=false)
- Trả uuid[] (coalesce về '{}' khi rỗng)
- Grants: như 4.1
- Coerce array null → '{}'::uuid[] (pattern đã có trong `save_match_attempt`)

### 4.3. React cache() cho streak

- Tạo `src/features/statistics/server/load-cached-statistics.ts` (hoặc thêm vào file hiện có — chọn 1, không tạo trùng):
  - `export const loadCachedStreakSummary = cache(loadStreakSummary)`
  - `export const loadCachedStreakDates = cache(async (supabase) => ...)` — load `daily_learning_records.local_date` 1 lần, trả `{ dates: string[], timezone: string, today: string }`
- Sửa:
  - `loadStreakSummary` dùng `loadCachedStreakDates` (bỏ query lặp)
  - `loadMonthlyStreakDates` dùng `loadCachedStreakDates` (lọc theo month từ dates đã có — computeStreakRun giữ nguyên)
  - `loadMascotLevel` dùng `loadCachedStreakSummary`
  - `src/app/(app)/layout.tsx` (AppShell) dùng `loadCachedStreakSummary`
  - `dashboard/page.tsx` dùng `loadCachedStreakSummary` (bỏ gọi thẳng)
- ⚠️ React `cache()` chỉ memoize trong 1 request — KHÔNG phải cache bền giữa requests (đúng ý đồ: tránh query lặp trong cùng 1 render, không lo dữ liệu cũ)

### 4.4. Dashboard dùng RPC

- `dashboard/page.tsx`: thay khối `collectStudyCardIds + loadWrongAnswerCardIds + loadUntouchedCardCount` bằng `supabase.rpc("get_dashboard_counts")` → `{ due_count, untouched_count }`
- Giữ nguyên: giao diện, `learningError` state (RPC lỗi → hiện "Không thể tải số thẻ cần ôn."), smart-review/new-cards buttons
- Xóa import không còn dùng (loadWrongAnswerCardIds, loadUntouchedCardCount, collectStudyCardIds — chỉ nếu không còn chỗ nào khác dùng; verify bằng grep)

### 4.5. Quiz setup + startQuiz dùng RPC

- `getQuizEligibility`: thay `collectStudyCardIds + loadUncoveredIds + loadWrongAnswerCardIds` bằng 1 lần `rpc("get_quiz_scope_sets", ...)` → `{ total, uncovered: uncovered_ids.length, wrong: wrong_ids.length }`
- `startQuiz`:
  - poolIds vẫn từ `collectStudyCardIds` (giữ nguyên — cần đúng thứ tự hiện tại cho shuffle)
  - thay `Promise.all([loadUncoveredIds, loadWrongAnswerCardIds])` bằng 1 lần `rpc("get_quiz_scope_sets", ...)` → dùng `uncovered_ids`/`wrong_ids` cho `selectCardsByPriority`
  - ⚠️ Đảm bảo không có hành vi khác: `loadUncoveredIds("quiz", shuffled)` filter mode='quiz' — RPC phải mirror đúng
- Verify bằng grep: `loadUncoveredIds` / `loadWrongAnswerCardIds` còn chỗ nào dùng (study modes / match / memory / runner dùng riêng — KHÔNG đụng, trừ khi chúng gọi chung helpers bị xóa)

## 5. Verification gates (bắt buộc)

1. `npx supabase db reset` PASS (migration chain chạy từ DB trống)
2. `npm run db:test` PASS — pgTAP mới `036_dashboard_counts.sql` (hoặc số tiếp theo):
   - Grants/security boundary (prosecdef/invoker, search_path='', anon revoke, authenticated + service_role execute)
   - `get_dashboard_counts`: fixture user có quiz sai + match sai + typing sai + chưa học → due/untouched đúng; RLS isolation user B không thấy user A
   - `get_quiz_scope_sets`: scope theo set, theo collection, theo all; dedupe khi set + collection trùng; uncovered theo mode='quiz'; wrong theo latest-answer
   - Đối chiếu kết quả với logic cũ (chạy helper cũ song song trong test nếu cần)
3. `npm run check`: lint 0 errors, typecheck clean, unit pass (cập nhật unit test dashboard/quiz nếu cần), build OK
4. Unit test mới: dashboard counts mapping, quiz scope RPC mapping (mock supabase)
5. E2E regression: `npm run test:e2e -- foundation primary-navigation dashboard quiz-advancement study-mode` — ít nhất các spec chạm dashboard + quiz setup phải pass
6. `git diff --check` sạch
7. Gemini review độc lập (DB) — APPROVE kèm findings

## 6. Files dự kiến

- `supabase/migrations/2026XXXXXXXX_dashboard_and_quiz_scope_rpcs.sql` (mới)
- `supabase/tests/036_dashboard_counts.sql` (mới)
- `src/lib/supabase/types.ts` (regen — thêm 2 RPC)
- `src/features/statistics/server/load-statistics.ts` (cache streak/dates)
- `src/features/statistics/server/load-cached-statistics.ts` (mới, nếu tách)
- `src/features/mascot/server/load-mascot-level.ts` (dùng cached)
- `src/app/(app)/layout.tsx` (dùng cached)
- `src/app/(app)/dashboard/page.tsx` (RPC counts)
- `src/features/quiz/server/actions.ts` (getQuizEligibility + startQuiz dùng RPC)
- Unit tests tương ứng
- KHÔNG đụng: study/match/memory/runner/typing logic, import, sharing, notifications UI

## 7. Lưu ý cho implementer

- Đọc trước: `supabase/migrations/20260817100000_push_notifications.sql` (pattern get_due_review_card_count), `src/features/practice-coverage/server/actions.ts` (loadWrongAnswerCardIds/loadUncoveredIds — nguồn sự thật để mirror), `src/features/dashboard/server/load-learning-counts.ts` (loadUntouchedCardCount)
- Mirror logic CHÍNH XÁC, không "cải tiến" hành vi: untouched KHÔNG tính flashcard_coverage; wrong = latest answer; quiz chỉ tính session completed
- uuid[] trả về từ RPC: kiểm tra định dạng PostgREST (json array of uuid strings)
- KHÔNG đổi grant của RPC cũ; chỉ thêm RPC mới + grants của chúng
- Nếu React cache() gây vấn đề với SupabaseClient (không serializable?) — `cache()` của React chỉ memoize function call theo args, không cần args serializable; dùng được với client instance
- Chạy lại db reset TRƯỚC db:test (theo convention dự án)

## 8. Evidence report template

```text
Repository: start <baseline> → final <hash> (1 commit, N files), push status: NOT pushed
Trích code: RPC get_dashboard_counts + get_quiz_scope_sets (ngắn), loadCachedStreakSummary
Verification:
- npx supabase db reset: PASS
- npm run db:test: <files>/<asserts> PASS (036: <n>/<n>)
- npm run check: lint X/Y, typecheck, unit N passed, build OK
- E2E regression: foundation primary-navigation dashboard quiz-advancement study-mode: N/N PASS
- git diff --check: PASS
Gemini review: APPROVE/REJECT kèm findings
Safety: migrations YES (1 additive + pgTAP) · DB YES · deps NO · env NO · AI NO · production NO
Ambiguities: <auth.uid() vs p_user_id; React cache() phạm vi 1 request; ...>
```

## 9. Nguồn tài liệu

- AGENTS.md §6 (server-first, ranh giới dữ liệu), §9 (bảng), §19 (testing)
- Chẩn đoán đầy đủ trong `docs/DECISIONS/` nếu cần lưu (tùy chọn)
