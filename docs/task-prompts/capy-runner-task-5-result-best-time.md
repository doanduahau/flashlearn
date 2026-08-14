# Capy Runner — Task 5: result page + coverage completion + best-time

> **Status:** verified — commit `1543edf` (chờ user xác nhận push; Sol review đã sạch, không còn blocker)
> **Baseline commit:** `cc01af8` (feat: retune runner jump and answer label UX) — trên origin/main
> **Agent tier:** Codex + GPT-5.6 Terra (chính); **Codex + GPT-5.6 Sol (review bắt buộc sau khi xong)** — chạm RPC ghi dữ liệu + coverage lifecycle + concurrency
> **Decisions locked (user):**
>
> - **Nút "Chơi lại" giữ nguyên source** như Match/Memory: khi start, URL session chứa source params (all/sets/collections/count/filter/difficulty); "Chơi lại" tạo session mới đúng cùng phạm vi + độ khó.
> - **Result overlay:** Hoàn thành/Hết mạng + mascot (congrats/sad) + thời gian + "Kỷ lục mới!" khi `is_new_best` (kèm best hiện tại) + số câu + độ khó + nút Chơi lại/Quay lại.
> - **Game-over:** KHÔNG complete coverage, KHÔNG ghi best (frozen rule Task 2 §7 — giữ nguyên).
> - **Best-time scope:** đã chốt ở DB — `(user_id, difficulty, question_count)`, RPC `submit_runner_best_time` tự suy từ DB, không nhận difficulty/count từ client.
>   **Ngoài phạm vi:** engine Task 2 (`runner-state.ts`/`config.ts`/`runner-difficulty.ts`/types) — KHÔNG đụng; timing/lives/jump/HUD — KHÔNG đổi; migration mới — KHÔNG cần (Task 5 chỉ dùng RPC đã tồn tại); AI — KHÔNG.

---

## 0. Before starting

Baseline = `cc01af8` trên `main` (or strictly newer). Chạy `git status` / `git log -5` / `git pull --ff-only`.

Đọc trước:

- RPC `submit_runner_best_time` — `supabase/migrations/20260813020000_add_runner_database_foundation.sql` (dòng ~341): input `(p_runner_session_id uuid, p_elapsed_ms integer)` → output `(result_best_ms integer, result_question_count integer, is_new_best boolean)`. **Bắt buộc coverage session của runner đã `completed_at is not null`** — nếu chưa complete sẽ `raise exception 'invalid runner session'`. Atomic best-only upsert theo `(user_id, difficulty, question_count)`; SECURITY DEFINER, `search_path=''`, grant execute `authenticated` (không cần admin client).
- RPC `complete_learning_coverage_session(p_session_id)` — `supabase/migrations/20260812200000_make_learning_coverage_session_safe.sql` (dòng ~99): output `(completed_at, did_reset)`; idempotent (session đã complete thì trả về hiện tại, không reset lại). Grant execute `authenticated, service_role`.
- Server action có sẵn: `src/features/practice-coverage/server/actions.ts` → `completeLearningCoverageSession(sessionId)` — dùng `createClient()` (authenticated), validate `z.uuid()`, lấy `sub` từ claims, gọi RPC, trả `{ok, didReset}` hoặc `{ok:false, error}`. **Tái sử dụng — không viết lại.**
- Pattern Match/Memory: `src/features/match/components/match-session.tsx` + `src/app/(app)/match/session/page.tsx` (buildQuery giữ source trong URL, replay gọi lại start action, done state có "Chơi lại" + "Quay lại", completionError state có "Thử lại").
- Runner hiện tại: `src/features/runner/components/runner-session.tsx` (engine trong `useRef`, `computeDisplay` — **lưu ý display chỉ giữ `elapsedSeconds` đã floor xuống giây**, cần ms chính xác cho best time), `src/features/runner/components/runner-end-overlay.tsx` (chỉ hiển thị "Hết mạng!"/"Hoàn thành!" + thời gian + Quay lại), `src/features/runner/server/actions.ts` (`startRunnerSession` trả `runnerSessionId`; hiện setup push chỉ `?sessionId=...`), `src/app/(app)/runner/session/page.tsx` (server page hiện chỉ select `difficulty` từ `runner_sessions`, KHÔNG có `coverage_session_id`).
- pgTAP: `supabase/tests/027_runner_personal_bests.sql` (25 assertions — contract RPC best time đã cover đầy đủ; Task 5 không cần thêm DB test, chỉ cần chạy lại để chứng minh không regression).

Nếu repo mâu thuẫn với rules dưới → **STOP và hỏi**. Không tự quyết.

## 1. Scope

Task 5 wire phần kết thúc trận đấu:

1. **Server action mới** `submitRunnerBestTime(runnerSessionId, elapsedMs)` trong `src/features/runner/server/actions.ts` — gọi RPC `submit_runner_best_time` qua `createClient()`.
2. **Server session page** select thêm `coverage_session_id`, parse source params từ URL, truyền xuống client component.
3. **RunnerSession** (client): khi trạng thái chuyển sang `completed` → gọi `completeLearningCoverageSession(coverageSessionId)` **trước**, rồi `submitRunnerBestTime(runnerSessionId, elapsedMs)` — đúng thứ tự bắt buộc của RPC (complete trước, submit sau). Khi `game-over` → không gọi gì.
4. **Result overlay** hiển thị đầy đủ + nút **Chơi lại** (tạo session mới từ source trong URL) + **Quay lại** (`/runner`).

**KHÔNG đụng:** engine Task 2, timing/difficulty config, migration/schema, deps, env, AI, Quiz/Match/Memory behavior.

## 2. Contract đã đóng băng (không đổi)

- `submit_runner_best_time(p_runner_session_id, p_elapsed_ms)` — elapsed ms **integer > 0**; difficulty + question_count suy từ DB (session + coverage snapshot); `is_new_best` chỉ true khi lần gọi này insert hoặc cải thiện best.
- **Thứ tự bắt buộc:** complete coverage session của runner trước → submit best time sau. Nếu submit fail nhưng complete đã thành công: coverage đã đóng (không cần/học cách hoàn tác), chỉ cần retry submit.
- `complete_learning_coverage_session` idempotent — gọi lại an toàn.
- Game-over → không complete coverage, không submit best. Đây là quyết định frozen (Task 2 §7), không phải bug.

## 3. Server action — `submitRunnerBestTime`

Trong `src/features/runner/server/actions.ts`:

```ts
export type SubmitRunnerBestTimeResult =
  | { ok: true; bestMs: number; questionCount: number; isNewBest: boolean }
  | { ok: false; error: string };
```

- Validate: `runnerSessionId` = `z.uuid()` (dùng schema Zod, có thể thêm `runnerBestTimeSchema` trong `src/features/runner/schemas/runner-schema.ts`); `elapsedMs` = integer > 0 (`z.number().int().positive()`, cũng chặn `NaN`/`Infinity` theo Zod behavior — kiểm tra và xử lý rõ).
- Lấy `sub` từ server claims (`authenticatedUserId` helper đã có); không tin `user_id` từ client.
- Gọi qua `createClient()` (authenticated, RPC đã grant execute cho authenticated — **không dùng admin client**).
- Lỗi RPC → trả `{ ok: false, error: "Không thể lưu kỷ lục lúc này." }` (generic, không leak SQL). Throw bất ngờ → catch → generic message.
- Không side effect nào khác.

## 4. Session page — `src/app/(app)/runner/session/page.tsx`

1. Select thêm `coverage_session_id` cùng với `difficulty` từ `runner_sessions` (RLS chỉ trả own row — đã có).
2. Parse source params từ `searchParams` để replay (pattern Match session page):
   - `all` (`"1"`), `sets` (comma-separated), `collections` (comma-separated), `count` (12|18|24 — whitelist `RUNNER_QUESTION_COUNTS`), `filter` (whitelist `learningFilters`), `difficulty` (whitelist easy|medium|hard).
   - **Bắt buộc có `sessionId`** (redirect `/runner` nếu thiếu — như hiện tại). Source params chỉ cần thiết cho "Chơi lại": nếu thiếu/không hợp lệ → vẫn load session (sessionId là nguồn sự thật của payload), nhưng **ẩn nút "Chơi lại"** (hoặc redirect như Match? — **chọn: giữ load, ẩn Chơi lại** vì sessionId hợp lệ là đủ để chơi; không phạt người vào thẳng URL).
3. Truyền xuống `<RunnerSession>`: `questions`, `difficulty`, `mascotLevel` (như cũ) + `runnerSessionId`, `coverageSessionId`, `replaySource` (object `{all, setIds, collectionIds, questionCount, filter, difficulty}` hoặc `null` khi thiếu).
4. Dùng `key={sessionId}` cho `<RunnerSession>` để đảm bảo remount khi đổi session (đặc biệt khi replay push URL session mới) — engine state không bị giữ lại từ session cũ.

## 5. Setup page — `src/features/runner/components/runner-setup.tsx`

Khi start thành công, push URL kèm source params (không chỉ `?sessionId=...`):

```text
/runner/session?sessionId=<id>&all=1&count=12&filter=unseen&difficulty=medium
```

hoặc với source cụ thể:

```text
/runner/session?sessionId=<id>&sets=<id1>,<id2>&count=18&filter=wrong&difficulty=hard
```

- Tạo helper build query (pattern `buildQuery` của Match session page — có thể để trong `src/features/runner/utils/` hoặc local; không cần dùng chung với Match, không refactor Match).
- Luôn ghi `count`, `filter`, `difficulty`; ghi `all=1` hoặc `sets`/`collections` tùy lựa chọn.

## 6. RunnerSession — `src/features/runner/components/runner-session.tsx`

Props mới: `runnerSessionId: string`, `coverageSessionId: string`, `replaySource: RunnerReplaySource | null`.

### 6.1 Khi completed

Khi `display.status` chuyển sang `"completed"` (lần đầu tiên), thực hiện theo thứ tự:

```text
completeLearningCoverageSession(coverageSessionId)
  → nếu fail: hiện lỗi + nút "Thử lại" (pattern completionError của Match/Memory)
  → nếu ok: submitRunnerBestTime(runnerSessionId, elapsedMsChinhXac)
      → nếu fail: hiện lỗi + nút "Thử lại" (chỉ retry submit, KHÔNG gọi complete lại)
      → nếu ok: lưu { bestMs, isNewBest, questionCount } để overlay hiển thị
```

- **Elapsed ms chính xác:** hiện `computeDisplay` chỉ giữ `elapsedSeconds = floor(elapsedMs/1000)` → best time bị làm tròn xuống giây. **Thêm `elapsedMs` (integer ms) vào display snapshot** (hoặc đọc từ `stateRef.current.elapsedMs`) để submit giá trị chính xác. Overlay hiển thị thời gian vẫn dùng `formatRunnerTime` như hiện tại.
- **Chỉ submit 1 lần:** dùng `useRef` guard (vd `submittedRef`) — engine terminal state đã ổn định nhưng phòng Strict Mode double-effect / re-render. Nếu submit đang pending mà overlay re-render → không gọi lại.
- **Trạng thái lỗi:** không block overlay hiển thị kết quả cơ bản (thời gian + mascot vẫn hiện); lỗi hiển thị kèm nút "Thử lại". Overlay chỉ cần chờ submit xong để hiện dòng "Kỷ lục mới!"/best — có thể hiện dòng "Đang lưu kỷ lục…" trong lúc chờ.
- **Game-over:** không gọi complete, không gọi submit — chỉ hiển thị overlay.

### 6.2 Overlay — `runner-end-overlay.tsx`

Props mở rộng (đề xuất):

```ts
{
  status: "game-over" | "completed";
  elapsedMs: number;
  level: MascotLevel;
  mascotState: MascotState;
  difficultyLabel: string;        // runnerDifficultyLabel(difficulty)
  questionCount: number;          // questions.length
  best: { bestMs: number; isNewBest: boolean } | null;  // null khi đang lưu/lỗi chưa có
  onBack: () => void;
  onReplay: (() => void) | null;  // null khi thiếu replaySource
}
```

Hiển thị:

- **Hoàn thành:** mascot congrats (wrongCount ≤ 1) / sad (như hiện tại) + "Hoàn thành!" + "Thời gian mm:ss" + `N câu · Độ khó` + dòng best:
  - `isNewBest` → **"Kỷ lục mới! mm:ss"** (điểm nhấn).
  - không mới → "Kỷ lục: mm:ss" (best hiện tại từ `bestMs`).
  - `best === null` → "Đang lưu kỷ lục…" (hoặc lỗi + "Thử lại").
- **Hết mạng:** mascot sad + "Hết mạng!" + `N câu · Độ khó` + số câu đã hoàn thành đúng (nếu có — `questionIndex` = số câu đúng đã qua; kiểm tra chính xác với engine: `completedCount`). **Không** hiện dòng kỷ lục.
- Nút: **"Chơi lại"** (chỉ khi `onReplay != null`) + **"Quay lại"** (`/runner`).
- Giữ nguyên a11y hiện có (img `alt=""` + `aria-hidden`).

### 6.3 Replay

`onReplay`:

- Gọi `startRunnerSession(replaySource)` (server action Task 3 đã có, input khớp `runnerStartSchema` — `{all, setIds, collectionIds, questionCount, filter, difficulty}`).
- Thành công → `router.push('/runner/session?<query với sessionId mới + source params>')` (giống setup push).
- Thất bại → hiện lỗi (dùng state error trong overlay hoặc component — chọn cách đơn giản, pattern có sẵn).

## 7. Types

- `src/features/runner/types/runner-types.ts`: thêm `RunnerReplaySource` (hoặc tái sử dụng shape input của `runnerStartSchema` — kiểm tra và chọn cách tránh duplicate; nếu `runnerStartSchema` đã có `z.infer` type thì dùng nó).
- KHÔNG đổi engine types (`RunnerState`, `RunnerEvent`, `RunnerStatus`...).

## 8. Duplicate-event / idempotency

- `submitRunnerBestTime` chỉ chạy đúng 1 lần cho mỗi lần completed (guard ref).
- Retry submit sau lỗi: RPC an toàn (best-only upsert) — gọi lại không làm hỏng best.
- `completeLearningCoverageSession` idempotent — nếu UI retry gọi lại, DB không reset.
- Refresh trang khi đang completed → session page load lại → engine reset về `ready` (payload vẫn load được). **Chấp nhận hành vi này** (giống các mode khác) — không cần chặn; nếu chơi lại cùng session cũ thì RPC xử lý đúng (is_new_best chỉ true khi nhanh hơn). Không thêm cơ chế chống refresh.

## 9. Verification

### Unit / component

- Cập nhật `tests/unit/features/runner/runner-session.test.tsx`: mock `completeLearningCoverageSession` + `submitRunnerBestTime` + `useRouter`; test:
  - completed → gọi complete trước, submit sau (thứ tự), đúng sessionId/coverageSessionId/elapsedMs.
  - submit fail → overlay hiện lỗi + "Thử lại" → retry chỉ gọi submit (không gọi complete lần 2).
  - game-over → KHÔNG gọi complete, KHÔNG gọi submit.
  - double render (Strict Mode simulation) → submit chỉ 1 lần.
  - `isNewBest=true` → hiện "Kỷ lục mới!"; `false` → hiện best hiện tại.
- Cập nhật/viết test `runner-end-overlay.test.tsx`: các nhánh hiển thị (Hoàn thành + best / Hoàn thành + new best / Hết mạng không best / ẩn Chơi lại khi replaySource null).
- Test `submitRunnerBestTime` nếu có pattern mock server action trong repo (kiểm tra — nếu các server action khác không có unit test riêng thì bỏ qua, coverage qua component test là đủ; ghi rõ quyết định trong report).

### E2E (`tests/e2e/runner-gameplay.spec.ts`)

- Luồng chơi nhanh đến completed (dùng `--fast` nếu có flag/helper của suite — kiểm tra; nếu không, dùng cách hiện có) → assert: overlay "Hoàn thành!", có dòng "Kỷ lục mới!" hoặc "Kỷ lục:", nút "Chơi lại" + "Quay lại" hiển thị.
- Bấm "Chơi lại" → về session mới (URL đổi sessionId, cùng source) → start overlay xuất hiện.
- Game-over path (nếu E2E có cách ép mạng về 0 — kiểm tra helper; nếu quá flaky, bỏ qua game-over E2E và ghi rõ, chỉ cover qua unit).
- KHÔNG thêm test flaky dựa trên timing.

### Gate

```bash
npx vitest run tests/unit/features/runner
npm run db:test          # 027_runner_personal_bests vẫn PASS — không regression
npm run check
npm run test:e2e -- runner-gameplay
```

## 10. Diff review

- Không migration/DB/deps/env/AI.
- Không đụng engine Task 2.
- Không thay đổi hành vi Match/Memory/Quiz.
- Không refactor `practice-coverage/server/actions.ts` (chỉ import).
- `elapsedMs` truyền chính xác (không floor giây) cho RPC.
- No `Date.now()`/`Math.random()` mới trong reducer; chỉ dùng trong UI/session như hiện tại.
- Worktree sạch ngoài file task.

## 11. Commit

```bash
git add <task-related-files>
git commit -m "feat: add runner result and best time persistence"
```

Push lên `origin/main` (Task 5 thuần dùng RPC có sẵn, không migration → sau khi Sol review sạch + user xác nhận mới push; nếu prompt này được giao kèm hướng dẫn push, tuân theo).

## 12. Evidence report

Trả về theo format chuẩn các task trước: Repository (start/final commit, push status, worktree), Flow (completed: complete→submit thứ tự; game-over: không gọi), Result overlay (nội dung hiển thị), Replay (giữ source, URL mới), Tests (files, counts, direct evidence cho từng assertion), Files changed, Safety (migrations/DB/deps/env/AI/production), Ambiguities (nếu có), Verdict (`EVIDENCE READY FOR REVIEW` hoặc `INCOMPLETE — BLOCKER REQUIRES USER DECISION`).
