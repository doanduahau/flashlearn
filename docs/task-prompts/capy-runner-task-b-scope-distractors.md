# Capy Runner — Task B: đa dạng hóa đáp án nhiễu (distractor từ các câu khác trong phiên)

> **Status:** verified (2026-08-14) — commit `6a08df6`, đã push origin/main; migration chưa push production (chờ user xác nhận). Sol review: APPROVE (bắt được lỗi double-backslash trước commit).
> **Baseline commit:** commit của Task A (`feat: retune capy runner UX`) hoặc mới hơn — trên origin/main
> **Agent tier:** Codex + GPT-5.6 Terra (chính); **Codex + GPT-5.6 Sol (review bắt buộc sau khi xong)** — chạm migration DB + RLS + service-role boundary
> **Decisions locked (user):**
>
> - Đáp án nhiễu của mỗi câu hỏi Runner lấy **từ các flashcard khác trong chính phiên** (không phải toàn bộ thư viện như hiện tại).
> - Ví dụ phiên 12 câu: câu hỏi 1 có đáp án đúng + 2 đáp án nhiễu lấy từ 11 câu còn lại trong phiên.
> - Vẫn **deterministic, seeded** (không random thật sự, không AI) — giữ nguyên nguyên tắc deterministic-first của dự án.
> - Thẻ trong phiên bị **trùng nội dung mặt sau (sau chuẩn hóa)** với thẻ đang hỏi thì không thể làm đáp án nhiễu cho thẻ đó — cơ chế eligibility hiện có (ẩn thẻ + thông báo) giữ nguyên.
>   **Ngoài phạm vi:** AI sinh đáp án nhiễu (backlog riêng — `ai-distractor-fallback-plan.md`); Quiz; các learning mode khác; UI game; thay đổi UI khác.

---

## 0. Before starting

Baseline = commit Task A trên `main` (or strictly newer). Chạy `git status` / `git log -5` / `git pull --ff-only`.

Đọc trước:

- Migration hiện tại: `supabase/migrations/20260813020000_add_runner_database_foundation.sql` — đặc biệt 3 hàm:
  - `load_runner_session_questions` (dòng ~235) — nơi sinh choices: hiện lấy distractor từ **toàn bộ thư viện user** với seed = session id
  - `load_runner_candidate_eligibility` (dòng ~200) — kiểm tra "≥2 đáp án sai phân biệt trong toàn thư viện"
  - `create_runner_session` (dòng ~135) — re-validate "≥2 đáp án sai trong toàn thư viện"
- pgTAP: `supabase/tests/026_runner_sessions.sql`, `supabase/tests/027_runner_personal_bests.sql` — đặc biệt test "same session produces identical deterministic choices" (dòng ~180) và test eligibility
- `docs/LEARNING_MODES.md` — "Flashcard Runner" + "Frozen Runner rules" (mục distractor)
- Server: `src/features/runner/server/actions.ts` (không đổi logic — chỉ verify payload vẫn khớp); `src/features/runner/utils/map-runner-session-payload.ts` (contract 3 choices)

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Tạo **migration mới** (KHÔNG sửa migration `20260813020000` đã áp dụng) để đổi nguồn distractor của Runner:

**Trước:** distractor = 2–3 thẻ bất kỳ trong **toàn bộ thư viện user** (seed = session id → cùng session, mọi câu hỏi chọn distractor giống hệt nhau — bug "câu nhiễu cố định").

**Sau:** distractor của câu hỏi `Q` = **2 thẻ khác lấy từ chính các câu trong phiên** (`session_card_ids`), loại trừ:

- thẻ có mặt sau trùng chuẩn hóa với mặt sau của `Q`;
- trùng lặp lẫn nhau sau chuẩn hóa.

Seed vẫn deterministic nhưng phải **khác nhau giữa các câu hỏi trong cùng phiên** (seed = session id + flashcard id của câu hỏi, hoặc tương đương) để mỗi câu có distractor khác nhau.

## 2. Migration mới — nội dung

File mới, ví dụ: `supabase/migrations/20260814010000_runner_scope_distractors.sql` (đặt timestamp sau migration hiện có). `CREATE OR REPLACE` 3 hàm (giữ nguyên chữ ký tham số, giữ nguyên security model, search_path, grants/revokes):

### 2.1 `load_runner_session_questions`

- Giữ nguyên: snapshot questions từ `v_coverage.session_card_ids`, fail-toàn-bộ nếu thiếu, trả về 1 câu hỏi/thẻ, chữ ký `(p_runner_session_id uuid)`.
- Đổi phần distractor: thay vì `select ... from public.flashcards f where f.user_id = v_user_id` (toàn bộ thư viện), lấy từ **các thẻ khác trong `v_coverage.session_card_ids`** (join `public.flashcards` theo id để lấy `back`; bỏ qua thẻ không còn tồn tại — hoặc fail-toàn-bộ như rule hiện tại, giữ nguyên quy tắc hiện có: snapshotted card không còn → fail cả load).
- Chuẩn hóa: `lower(regexp_replace(btrim(back), '\s+', ' ', 'g'))` — giữ nguyên hàm chuẩn hóa hiện tại (phải khớp chính xác với eligibility + create để TOCTOU không xảy ra).
- Chọn đúng **2 distractor** phân biệt (normalized), seeded: ví dụ `order by md5(f.id::text || p_runner_session_id::text || v_card.live_card_id::text)` hoặc tương đương → mỗi câu hỏi khác nhau nhưng vẫn deterministic với cùng session.
- Kết quả: đúng **3 choices** (1 đúng + 2 nhiễu), shuffle deterministic (giữ cơ chế md5-ordering hiện có cho thứ tự choices).
- Nếu không đủ 2 distractor phân biệt trong phiên → `raise exception` (giống rule hiện tại) — nhưng eligibility (2.2) phải ngăn chuyện này từ trước.

### 2.2 `load_runner_candidate_eligibility`

- Đổi điều kiện: một thẻ `eligible` khi trong **tập thẻ được truyền vào (`p_card_ids`)** có ≥2 thẻ khác có mặt sau chuẩn hóa khác mặt sau của thẻ đó (trước đây: trong toàn thư viện).
- Giữ nguyên: `p_card_ids uuid[]` → `(flashcard_id, eligible boolean)`, `security invoker`, `search_path = ''`, grants (authenticated).

### 2.3 `create_runner_session`

- Đổi re-validation: thay vì "≥2 wrong answers trong toàn thư viện user", kiểm tra **trong chính `p_session_card_ids`** có ≥2 thẻ khác với normalized back khác thẻ đang xét.
- Giữ nguyên: service-role only, `security definer`, transaction, composite FK, trigger coverage mode runner.

## 3. Ràng buộc

- **KHÔNG sửa migration `20260813020000`** (đã áp dụng production).
- **KHÔNG đổi chữ ký hàm** — server `actions.ts` không cần sửa (chỉ cần re-run build/test).
- **KHÔNG đổi chuẩn hóa** — `lower(regexp_replace(btrim(...), '\s+', ' ', 'g'))` dùng chung đúng 1 nơi (khai báo hằng số hoặc helper SQL nếu tiện, nhưng phải đồng bộ 3 hàm).
- **KHÔNG AI / Gemini / random thật** — seeded deterministic.
- Giữ grants/revokes y hệt hiện tại (authenticated chỉ SELECT/execute, service_role admin; không mở thêm quyền).

## 4. pgTAP tests

Cập nhật hoặc thêm test trong `supabase/tests/` (thêm file mới nếu cần, ví dụ `028_runner_scope_distractors.sql` — KHÔNG sửa 026/027 nếu chúng vẫn đúng; nếu 026 assert "distractor từ toàn thư viện" thì phải cập nhật cho khớp hành vi mới):

- Phiên N câu: mỗi câu hỏi có đúng 3 choices (1 đúng + 2 nhiễu).
- **Mỗi câu hỏi trong cùng phiên có bộ distractor khác nhau** (đây là điểm mới quan trọng — test trực tiếp bug cũ).
- Distractor nằm trong tập `session_card_ids` của phiên (không lấy từ ngoài phiên).
- Không có distractor trùng normalized với đáp án đúng; các distractor không trùng lẫn nhau.
- Deterministic: cùng session → cùng kết quả (re-run giống nhau).
- Eligibility: thẻ có ít hơn 2 thẻ khác (trong tập truyền vào) có normalized back khác → `eligible = false`.
- `create_runner_session` reject khi không đủ distractor trong `p_session_card_ids`.
- Giữ/điều chỉnh các test RLS/ACL hiện có cho khớp.

## 5. Verification

```bash
npm run db:test          # pgTAP (supabase/tests/*.sql) — cần local Supabase
npx vitest run tests/unit/features/runner
npm run check
# E2E runner-setup (cần local Supabase): npm run test:e2e -- runner-setup
```

Lưu ý: nếu migration mới chưa áp dụng lên local thì chạy `supabase db reset` hoặc `supabase migration up` trước khi test.

## 6. Diff review

- Không sửa migration cũ; không đổi chữ ký/grants; không đổi chuẩn hóa; deterministic (không random); test mới cover đúng bug "distractor cố định"; không đụng Quiz/các mode khác; không AI.

## 7. Commit

```bash
git add supabase/migrations/20260814010000_runner_scope_distractors.sql supabase/tests/
git commit -m "fix: diversify runner distractors within session scope"
```

Push: chỉ khi baseline trên origin/main + mọi gate pass. Lưu ý: migration này chưa push lên production (bước deploy riêng sau khi Sol review + user duyệt — KHÔNG tự `supabase db push` trong task này).

## 8. Evidence report

- Repository: starting/final commit, push status, worktree.
- Mô tả: nguồn distractor mới; cách seed khác nhau giữa các câu; cách 3 hàm đồng bộ chuẩn hóa.
- Tests: files/discovered/passed/failed/skipped (pgTAP + unit).
- Files changed; Safety: migrations changed YES (migration MỚI, không sửa cũ); DB changed YES (sau khi push production — chưa làm); deps NO; env NO; AI NO; production NOT touched.
- Ambiguities; Verdict: `EVIDENCE READY FOR REVIEW` / `INCOMPLETE — BLOCKER REQUIRES USER DECISION`.
