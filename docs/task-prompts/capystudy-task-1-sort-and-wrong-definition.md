# CapyStudy — Task 1: thứ tự thời gian + định nghĩa "câu sai" (lần gần nhất)

> **Status:** delivered (2026-08-14)
> **Baseline commit:** `b22d218` (feat: spread capystudy mascot across app ui) — trên origin/main (hoặc mới nhất trên main)
> **Agent tier:** Codex + GPT-5.6 Terra (chính); **Codex + GPT-5.6 Sol (review bắt buộc)** — chạm logic dùng chung cho Quiz/Match/Memory/Runner/New Cards/Smart Review + query DB
> **Decisions locked (user):**
>
> - **Thứ tự thời gian:** bộ flashcard hiển thị ở MỌI nơi (trang Bộ flashcard, chọn nguồn trong Học, chọn nguồn trong Kiểm tra) xếp **mới nhất trên, cũ nhất dưới** (`created_at desc`).
> - **Nút "Sắp xếp" (kéo thả thủ công) GIỮ NGUYÊN** — mặc định xem theo thời gian, chế độ Sắp xếp vẫn hoạt động (xem chi tiết dưới).
> - **Định nghĩa "câu sai" đổi TOÀN HỆ THỐNG:** một flashcard được tính là "câu sai" nếu **lần trả lời GẦN NHẤT trong một bài kiểm tra đã hoàn thành là sai** (không còn là "từng sai 1 lần bao giờ").
> - **BỔ SUNG (2026-08-14, sau blocker): cho phép 1 migration MỚI** `CREATE OR REPLACE` RPC `create_quiz_session` — vì RPC này tự chọn câu hỏi theo historical wrong (`exists ... q.is_correct = false` + `wrong_count > 0` tại `20260813010000_harden_strict_quiz_session_creation.sql:85-94,123-128`); không sửa file migration cũ, chỉ tạo file mới + pgTAP.
>   **Ngoài phạm vi:** giao diện /sets (Task 2), trang Học/Kiểm tra (Task 3/4), thoát/pause (Task 5), giao diện match/study/header (Task 6) — KHÔNG làm ở task này.

---

## 0. Trước khi bắt đầu

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Xác nhận đang ở baseline trên origin/main. Đọc trước:

- `src/app/(app)/sets/page.tsx` (danh sách bộ thường/đặc biệt — hiện order theo `sort_order`)
- `src/features/source-selection/server/load-source-page.ts` (chọn nguồn Học/Kiểm tra — hiện order theo `name`)
- `src/features/practice-coverage/server/actions.ts` — hàm `loadWrongAnswerCardIds` (định nghĩa "câu sai")
- `supabase/migrations/20260806110000_add_quiz_engine.sql` (bảng `quiz_questions`: `is_correct`, `answered_at`)
- Test liên quan hiện có (`supabase/tests/`, `tests/unit/features/practice-coverage/` nếu có)

Nếu repository reality mâu thuẫn với frozen rules → **STOP và hỏi user**, không tự quyết.

---

## 1. Thứ tự thời gian (created_at desc)

### 1.1 Trang /sets — bộ thường

Hiện tại `src/app/(app)/sets/page.tsx`:

- List bộ thường: `.order("sort_order", ...).order("id", ...)` (cả chế độ reorder lẫn chế độ thường)
- Bộ đặc biệt: đã `.order("created_at", { ascending: false })` ✓ giữ nguyên

Yêu cầu:

- **Chế độ xem thường** (không phải `reorder=1`): bộ thường order theo `created_at desc`, break-tie bằng `id asc` (ổn định).
- **Chế độ Sắp xếp (`reorder=1`)**: GIỮ NGUYÊN hành vi hiện tại — hiển thị theo `sort_order asc, id asc` và cho phép kéo thả như cũ. Sau khi lưu reorder, quay về chế độ xem thường (theo thời gian). `sort_order` chỉ có ý nghĩa trong chế độ Sắp xếp.
- **Không xóa** nút "Sắp xếp", không xóa `sort_order` column, không sửa migration.

### 1.2 Chọn nguồn trong Học và Kiểm tra

`src/features/source-selection/server/load-source-page.ts`:

- Hiện tại `.order("name", { ascending: true })` cho cả bộ thường (dòng ~63) và bộ đặc biệt (dòng ~81).
- Đổi **cả hai** sang `.order("created_at", { ascending: false })` + break-tie `.order("id", { ascending: true })` — bộ mới tạo hiện lên trên trong SourceBrowser (dùng ở /study, /quiz, /memory, /runner, /match).

### 1.3 Nơi khác (kiểm tra + sửa nếu còn sót)

Quét toàn bộ `src/` tìm các query `flashcard_sets` / `special_collections` hiển thị danh sách cho người dùng:

- Nếu còn chỗ nào order theo `sort_order` hoặc `name` mà KHÔNG phải chế độ reorder → đổi sang `created_at desc`.
- Nơi nào đã `created_at desc` → giữ nguyên.
- Không đổi order của `flashcards` TRONG một bộ (giữ nguyên `position`/thứ tự hiện có — không nằm trong yêu cầu).

---

## 2. Định nghĩa "câu sai" — lần trả lời gần nhất

### 2.1 Hiện trạng (bug)

`loadWrongAnswerCardIds` (`src/features/practice-coverage/server/actions.ts:46`):

- Query `quiz_questions` có `is_correct = false` (trong session đã completed) → một card **từng sai 1 lần bao giờ** sẽ mãi nằm trong tập "câu sai".

Hệ quả user phàn nàn: card sai rồi, sau đó trả lời đúng nhiều lần, vẫn bị gắn là "câu sai" mãi.

### 2.2 Yêu cầu

Đổi định nghĩa thành: **card là "câu sai" nếu câu trả lời gần nhất (theo `answered_at`) trong một quiz session đã hoàn thành có `is_correct = false`**.

Cách làm đề xuất (agent có thể chọn cách sạch nhất phù hợp codebase, nhưng phải deterministic và đúng contract):

- Với tập `eligibleIds`, lấy với mỗi `flashcard_id` **lần trả lời mới nhất** trong `quiz_questions` thuộc session đã `completed_at is not null`.
- Nếu lần mới nhất đó `is_correct = false` → card thuộc tập "câu sai".
- Nếu lần mới nhất `is_correct = true` → KHÔNG thuộc tập "câu sai" (dù trước đó từng sai).
- Nếu chưa từng trả lời → không thuộc tập "câu sai".

### 2.2a Migration mới cho `create_quiz_session` (ĐÃ ĐƯỢC USER DUYỆT)

RPC `create_quiz_session` hiện tự chọn câu hỏi theo historical wrong tại `supabase/migrations/20260813010000_harden_strict_quiz_session_creation.sql`:

- eligibility count mode `wrong_answers`: `exists (... q.is_correct = false)` (dòng ~85-94)
- selection: `wrong_count > 0` + `order by ... wrong_count desc ...` (dòng ~123-128)

Yêu cầu: tạo **migration MỚI** (vd `20260814020000_quiz_wrong_latest_answer.sql`) `CREATE OR REPLACE` RPC `create_quiz_session` sao cho mode `wrong_answers` dùng định nghĩa mới:

- Card là "câu sai" nếu **câu trả lời mới nhất** (max `answered_at`) trong quiz session đã `completed_at is not null` có `is_correct = false`.
- Tie-breaking deterministic (vd: `answered_at` mới nhất, nếu bằng → `id`/`position` lớn nhất — chọn 1 quy tắc rõ, ghi trong migration comment).
- Giữ NGUYÊN: chữ ký RPC, security model (SECURITY DEFINER + hardened search_path + grant), validation đầu vào, các mode khác (`balanced`/`never_tested`/`pure_random`), snapshot/payload output.
- KHÔNG sửa file migration cũ (`20260813010000`) — chỉ tạo file mới (luật: không sửa migration đã áp dụng).
- pgTAP test mới (migration + `supabase/tests/`):
  - card sai lần gần nhất → thuộc pool `wrong_answers`;
  - card sai rồi đúng ở lần gần nhất → KHÔNG thuộc pool `wrong_answers`;
  - card chưa từng trả lời → không thuộc;
  - count sai lần gần nhất khớp với strict count;
  - các mode khác không đổi hành vi (regression).

Phần `loadWrongAnswerCardIds` (TS) vẫn sửa song song (mục 2.1-2.2) — sau khi xong, cả setup (loader TS) lẫn session creation (RPC) dùng chung định nghĩa mới, không mâu thuẫn.

### 2.3 Ảnh hưởng lan truyền (phải kiểm tra)

`loadWrongAnswerCardIds` được dùng bởi: Match, Memory, Runner, Quiz, New Cards, Smart Review (`src/features/*/server/actions.ts`). Sau khi đổi, các mode này đều tự theo định nghĩa mới — **không cần sửa từng nơi gọi**, nhưng phải chạy lại test của tất cả feature đó để xác nhận không vỡ.

---

## 3. Tests

### 3.1 Unit

- Nếu có test cho `loadWrongAnswerCardIds` → cập nhật/ca mới: card sai lần gần nhất → vẫn "câu sai"; card sai rồi đúng lần gần nhất → KHÔNG còn "câu sai"; card chưa từng trả lời → không "câu sai".
- Nếu chưa có test → thêm test cho hàm này (mock supabase query theo pattern test hiện có của feature này).

### 3.2 Regression

Chạy đủ:

- `npm run check`
- `npm run db:test` (nếu có DB test liên quan quiz/wrong-answer — xác nhận không regression)
- E2E liên quan: `npm run test:e2e -- runner-setup learning-mode-setup quiz-advancement smart-review` (nếu suite có — xác nhận flow "câu sai" không vỡ).

---

## 4. Verification

```bash
npm run check
npm run db:test          # bắt buộc — pgTAP mới + toàn bộ regression
npm run test:e2e -- runner-setup learning-mode-setup quiz-advancement smart-review
supabase db test          # nếu dùng lệnh này thay db:test — theo package.json
npm run test:e2e -- runner-setup learning-mode-setup quiz-advancement smart-review  # nếu suite có
git status
git diff --check
git diff --stat
git diff
```

Kiểm tra diff:

- **1 migration MỚI** (đã duyệt) — KHÔNG sửa file migration cũ;
- không đụng UI /sets (Task 2), không đụng study/quiz pages (Task 3/4);
- không đổi dependency.

## 5. Commit

```bash
git add <các file thuộc task>
git commit -m "fix: sort library by created time and define wrong cards by latest answer"
```

(Migration mới đi cùng commit này — message có thể bổ sung `, align quiz RPC wrong-answer definition` nếu cần.)

**Không push** — chờ review (Sol) + xác nhận của điều phối.

## 6. Evidence report

- Repository: starting/final commit, push status, worktree
- Thay đổi order: liệt kê từng query đã đổi + đường dẫn
- Định nghĩa câu sai: mô tả cách implement + ví dụ 3 case
- Tests: files/discovered/passed/failed/skipped
- Files changed
- Safety: migrations/DB/deps/env/AI/production — YES/NO
- Ambiguities
- Verdict: `EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
