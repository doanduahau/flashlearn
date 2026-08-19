# Task N17 — Gộp "số lần xuất hiện" theo nhóm Học / Kiểm tra (thay vì per-mode)

## Loại task

**Phức tạp / Quan trọng** — chạm DB (RPC + migration mới + pgTAP) và logic chọn đề ở 5 mode. Migration bắt buộc được review độc lập trước khi merge.

## Baseline

- Branch: `main`
- Baseline commit: `6a4c0ad` ("feat: show study card count immediately like quiz setup" — N16, đã push, main đồng bộ `origin/main`).
- Agent KHÔNG được tạo commit từ baseline khác. Chỉ làm đúng phạm vi task này.

## Bối cảnh

Thuật toán ưu tiên "câu sai trước, rồi đến câu ít xuất hiện" hiện dùng số lần xuất hiện **theo từng mode**:

- Quiz: `get_quiz_scope_sets` đếm `flashcard_coverage` với `c.mode = 'quiz'` (được viết bởi `create_quiz_session_prioritized` khi hoàn thành bài trắc nghiệm thủ công).
- Match/Typing: `loadAppearanceCounts("match" | "typing", ...)`.
- Memory/Runner: `loadAppearanceCounts("memory" | "runner", ...)`.

Yêu cầu: tách theo **nhóm** thay vì mode. Nhóm Kiểm tra gồm `quiz + match + typing`; nhóm Học gồm `memory + runner` (lật thẻ KHÔNG tham gia — đã chốt). "Câu sai" GIỮ NGUYÊN định nghĩa hiện tại (latest answer gộp toàn cục mọi mode) — KHÔNG đổi.

## Phạm vi

### 1. Code

**`src/features/practice-coverage/server/actions.ts`**

- Thêm 2 hằng số bucket (export để các feature khác import):
  - `export const QUIZ_COVERAGE_MODES = ["quiz", "match", "typing"] as const;`
  - `export const STUDY_COVERAGE_MODES = ["memory", "runner"] as const;`
- Đổi chữ ký `loadAppearanceCounts(mode: CoverageMode, eligibleIds: string[])` → `loadAppearanceCounts(modes: readonly CoverageMode[], eligibleIds: string[])`.
- Bên trong: filter `.in("mode", modes)` và **CỘNG dồn** `appearance_count` theo từng flashcard (một thẻ có thể có nhiều row ở nhiều mode trong nhóm — hiện code đang `set` đè, phải đổi thành `get ?? 0` + `row.appearance_count`).
- Cập nhật doc comment: "per-card appearance count across a mode group (quiz/match/typing or memory/runner)".

**Caller — đổi 4 chỗ:**

| File                                    | Dòng | Gọi mới                                                               |
| --------------------------------------- | ---- | --------------------------------------------------------------------- |
| `src/features/match/server/actions.ts`  | ~83  | `loadAppearanceCounts(QUIZ_COVERAGE_MODES, poolIds)`                  |
| `src/features/typing/server/actions.ts` | ~109 | `loadAppearanceCounts(QUIZ_COVERAGE_MODES, shuffled)`                 |
| `src/features/memory/server/actions.ts` | ~62  | `loadAppearanceCounts(STUDY_COVERAGE_MODES, allIds)`                  |
| `src/features/runner/server/actions.ts` | ~176 | `loadAppearanceCounts(STUDY_COVERAGE_MODES, shuffled.sessionCardIds)` |

**Comment cập nhật** (không đổi hành vi):

- `src/features/learning-modes/types.ts` — doc của `selectCardsByPriority`: nói rõ appearance là count trong nhóm mode (không còn "in the mode").
- `src/features/quiz/server/actions.ts` — `getQuizEligibility`: `uncovered` giờ là "chưa xuất hiện trong nhóm Kiểm tra (quiz/match/typing)". Field này KHÔNG dùng trong UI — không đổi hiển thị.
- `src/features/memory/server/actions.ts` — comment của `loadPriorityIds` (nếu nói per-mode).

### 2. Database — migration mới (bắt buộc)

**File mới:** `supabase/migrations/20260818010000_quiz_bucket_appearance.sql` (additive, `create or replace function`).

- `get_quiz_scope_sets(uuid[], uuid[], boolean)` — **KHÔNG đổi chữ ký / kiểu trả về** (tránh phải đổi generated types). Chỉ đổi CTE `appearance`:

```sql
appearance as (
  select s.id, coalesce(sum(c.appearance_count), 0) as count
  from scope s
  left join public.flashcard_coverage c
    on c.user_id = auth.uid()
   and c.mode in ('quiz', 'match', 'typing')
   and c.flashcard_id = s.id
  group by s.id
)
```

- Cập nhật `comment on function` cho khớp ("appearance count across quiz/match/typing").
- `revoke`/`grant` giữ nguyên (chữ ký không đổi).
- Lưu ý: `scope` + `latest` + `wrong` CTE và `wrong_ids` KHÔNG đổi.
- Ghi comment migration nêu rõ mục đích và quan hệ với 036 test.

### 3. pgTAP — `supabase/tests/036_dashboard_counts.sql`

- Sửa tiêu đề section 5 ("mode=quiz" → "mode group quiz/match/typing").
- **Mở rộng fixture + assert** để chứng minh phép CỘNG dồn: tạo coverage row thuộc mode `match` (và/hoặc `typing`) cho một thẻ đang có appearance 0 trong phạm vi quiz (theo đúng pattern fixture hiện có trong file — dùng `create_learning_coverage_session` + `complete_learning_coverage_session`), rồi assert appearance của thẻ đó trong `get_quiz_scope_sets` tăng lên đúng tổng. Giữ nguyên các assert `wrong_ids` và appearance của c1/c2/c3/c4 hiện có.
- Không sửa migration cũ; chỉ sửa file test (đây là file test, được phép sửa).

### 4. Unit test

- `tests/unit/features/typing/start-typing-session.test.ts:105` — assert `toHaveBeenCalledWith("typing", ...)` → `toHaveBeenCalledWith(["quiz", "match", "typing"], ...)` (hoặc dùng `QUIZ_COVERAGE_MODES`).
- Grep toàn `tests/` cho `loadAppearanceCounts` + `appearance_counts` và cập nhật mọi mock/call-assert cho khớp chữ ký mới. Riêng `quiz-eligibility.test.ts` và `start-quiz-prioritized.test.ts` mock map `appearance_counts` (shape không đổi) — chỉ cập nhật nếu có assert phụ thuộc giá trị.
- `select-cards-by-priority` là hàm thuần — không đổi, nhưng kiểm tra comment test nếu nhắc per-mode.

### 5. Ngoài phạm vi (KHÔNG làm)

- Không đổi định nghĩa "câu sai" (`latest` CTE / `loadWrongAnswerCardIds`).
- Không đổi `get_dashboard_counts` (dashboard tính độc lập từ `quiz_questions` + `mode_answer_events`, không đụng `flashcard_coverage`).
- Không thêm mode `study` vào `flashcard_coverage` (lật thẻ không tham gia — đã chốt).
- Không đổi UI, không đổi E2E (không có spec E2E assert theo appearance/priority — agent nên chạy grep để xác nhận).
- Không đổi generated types (`supabase/types.ts`) vì chữ ký RPC không đổi.

## Acceptance criteria

1. `loadAppearanceCounts` nhận danh sách mode và trả về **tổng** appearance theo nhóm.
2. Quiz dùng nhóm Kiểm tra (`quiz+match+typing`); match/typing dùng cùng nhóm; memory/runner dùng nhóm Học (`memory+runner`).
3. `get_quiz_scope_sets` trả appearance theo nhóm Kiểm tra, chữ ký không đổi.
4. pgTAP 036 có ít nhất một assert chứng minh appearance của một thẻ = tổng qua nhiều mode trong nhóm.
5. Không còn bất kỳ `loadAppearanceCounts(<string đơn mode>, ...)` hay `c.mode = 'quiz'` cho appearance (grep sạch).
6. `npm run check` xanh.

## Verification bắt buộc

```bash
npm run lint
npm run typecheck
npm run test
npm run build
# pgTAP 036 (chạy được khi có Supabase local/Docker)
```

Nếu Docker down và không chạy được pgTAP, báo rõ trong report: test nào đã chạy, test nào chưa + lý do. KHÔNG dùng `--no-verify` khi commit.

## Constraints (nhắc lại từ AGENTS.md)

- Không sửa migration đã áp dụng; chỉ thêm migration mới.
- Migration phải additive, chạy được từ DB sạch.
- Không dùng `any`, không `@ts-ignore`, không cast tùy tiện.
- Không thay đổi ngoài phạm vi.
- TypeScript strict.

## Report cuối task

- Summary.
- Files changed (kèm dòng chính).
- Database changes: file migration + cách chạy.
- Verification: kết quả từng lệnh (lint/typecheck/test/build), pgTAP đã chạy hay chưa.
- Remaining issues.
- Commit hash + message.
