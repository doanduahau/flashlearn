# Flashcard Runner V1 — Task 3: server wiring + setup page

> **Status:** verified (2026-08-14) — agent xong, đã đối chiếu với repo
> **Final commit:** `3137b33` (`feat: add runner setup and session wiring`) — đã push lên origin/main
> **Verification:** 66/66 unit tests pass (chạy lại); tsc sạch; eslint sạch; không AI/fetch/deps/migration; doc đúng 2 dòng; E2E 20/20 (agent chạy, tôi review spec — chưa tự chạy lại do thiếu local Supabase)
> **Baseline commit:** `526e0ef` (`feat: add runner gameplay core`)
> **Agent tier:** OpenCode + DeepSeek V4 Pro (chính); **Codex + GPT-5.6 Terra (review bắt buộc)** — task chạm service-role RPC (`create_runner_session`) và ownership
> **Decisions locked (user):**
>
> - Số câu: **12 / 18 / 24** (giống Match/Memory)
> - Độ khó: selector mới **Dễ / Vừa / Khó**, mặc định **Vừa**; giá trị lives/time lấy từ `getRunnerDifficultyConfig` (Task 2)
> - Thẻ thiếu 2 đáp án sai: **lọc tạm thời + thông báo nhỏ** — sẽ được thay bằng AI sinh đáp án nhiễu ở task riêng (xem `ai-distractor-fallback-plan.md`)
> - Có trang `/runner/session` **tối thiểu** (chứng minh luồng load payload; Task 4 thay bằng game)
> - Thẻ "Flashcard Runner" ở `/study?tab=play` thành link `/runner`
> - Đồng ý gửi nội dung thẻ lên Gemini cho task AI (chưa dùng trong task này)
>   **Doc sync (doc-only, được phép):** cập nhật `docs/LEARNING_MODES.md` — thêm dòng số câu 12/18/24 vào "Frozen Runner rules" + bỏ mục "Runner question count and session-selection UX." khỏi "Explicitly unresolved".
>   **Ngoài phạm vi:** Canvas/gameplay (Task 4), result/best-time (Task 5), AI đáp án nhiễu (task riêng), DB changes (KHÔNG).

---

## 0. Before starting

Task 2 is committed and verified on `main` at baseline
`526e0ef feat: add runner gameplay core` (or strictly newer). Before changing
anything run:

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Confirm `main` is up to date and `src/features/runner/` contains the Task 2
core (`config.ts`, `types/`, `utils/runner-state.ts`, `utils/runner-difficulty.ts`).

Read before choosing file names:

- `docs/LEARNING_MODES.md` — "Flashcard Runner" + "Frozen Runner rules"
  (note: the deterministic "reject ineligible cards" rule there is still true
  for this task — an upcoming AI-distractor task will supersede it later; do
  not redesign it here)
- `supabase/migrations/20260813020000_add_runner_database_foundation.sql` —
  `create_runner_session`, `load_runner_candidate_eligibility`,
  `load_runner_session_questions` contracts
- `src/features/match/server/actions.ts` + `src/features/match/schemas/match-schema.ts`
  - `src/features/match/components/match-setup.tsx` — the pattern to mirror
    (and the same pattern in `src/features/memory/`)
- `src/features/practice-coverage/server/actions.ts` — `loadUncoveredIds`,
  `loadWrongAnswerCardIds` (reuse as-is)
- `src/features/learning-modes/types.ts` + `components/mode-filter.tsx` +
  `components/question-count-selector.tsx` + `components/sticky-start-bar.tsx`
- `src/features/source-selection/components/source-browser.tsx`
- `src/features/runner/` (Task 2 core) — `getRunnerDifficultyConfig` is reused
- `src/app/(app)/match/page.tsx` + `src/app/(app)/match/session/page.tsx` +
  `src/app/(app)/study/page.tsx` (entry card)
- `tests/e2e/learning-mode-setup.spec.ts` (must be updated — see §8)
- `src/features/study/utils/shuffle.ts` — check for a pure `seededShuffle`
  util; reuse it if exported (per LEARNING_MODES.md), do not add a dependency

If repository reality conflicts with the frozen rules below:
**STOP and ask the user.** Do not invent behavior.

## 1. Scope

Implement the Runner setup flow end-to-end (deterministic only):

1. `/runner` setup page with source selection, learning filter, question
   count, and a NEW difficulty selector.
2. Server actions that validate input, load/filter/eligibility-check cards,
   and create a trusted Runner session via the service-role RPC.
3. A minimal `/runner/session` page that loads the prepared question payload
   via `load_runner_session_questions` and proves the wiring (read-only
   preview — NO gameplay).
4. Entry link: the "Flashcard Runner" card on `/study?tab=play` becomes a
   real link to `/runner`.

Must NOT be done here: Canvas/gameplay (Task 4), result/best-time (Task 5),
AI distractor generation (separate task), any DB/migration change, new
dependencies.

## 2. Routes and pages

### `/runner` (setup, server component)

Mirror `src/app/(app)/match/page.tsx`:

- metadata title "Flashcard Runner".
- Load `loadSourcePage(supabase, { page, query, type })` + total card count
  (same `Promise.all` shape as `/match`).
- Add `ModeTabs` grouping the play modes (follow the `ModeTabs` pattern from
  `/match`): label "Vừa học vừa chơi", items `Memory Matching → /memory`,
  `Match → /match`, `Flashcard Runner → /runner` (active).
- Render `<RunnerSetup sourcePage={sourcePage} totalCards={...} />`.

### `/runner/session` (minimal, server component)

- Reads `sessionId` from search params; invalid/missing → `redirect("/runner")`.
- Query `runner_sessions` (authenticated server client): `select("difficulty")
.eq("id", sessionId)` — not found → `redirect("/runner")` (difficulty is
  trusted server config, never from the client).
- Call RPC `load_runner_session_questions({ p_runner_session_id: sessionId })`
  via the authenticated server client. RPC error → friendly error UI (never
  leak DB error text); this includes the "runner session question
  unavailable" case.
- Map + validate rows to `RunnerQuestion[]` (see §6); on validation failure →
  friendly error UI.
- Render `<RunnerSessionPlaceholder questions={...} difficulty={...} />`:
  difficulty label (Dễ/Vừa/Khó), lives (from `getRunnerDifficultyConfig`),
  "Câu 1 / N", front text, and the 3 prepared choices as a read-only preview.
  This is the proof-of-wiring page; Task 4 replaces it with the game.

## 3. Schema

`src/features/runner/schemas/runner-schema.ts`:

```ts
runnerStartSchema = z.object({
  all: z.boolean().default(false),
  setIds: z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).max(50).default([]),
  collectionIds: z.array(z.uuid("Mã bộ đặc biệt không hợp lệ.")).max(50).default([]),
  questionCount: z.number().int().refine((v): v is 12 | 18 | 24 => RUNNER_QUESTION_COUNTS.includes(v as never)),
  filter: z.enum(learningFilters).default("unseen"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
}).superRefine(...) // copy the three source rules from matchStartSchema
```

`RUNNER_QUESTION_COUNTS = [12, 18, 24]` — define in `src/features/runner/types/runner-types.ts`
(next to the Task 2 types).

## 4. Server actions

`src/features/runner/server/actions.ts` — mirror `match/server/actions.ts`
exactly in structure (Zod → `createClient` → userId via `auth.getClaims()` →
load → filter → eligibility → build → admin RPC → result; catch → friendly
error).

### Shared pipeline (used by both actions)

1. `loadCards(supabase, { all, setIds, collectionIds })` — local helper copied
   from `match/server/actions.ts` (ownership check on `flashcard_sets` /
   `special_collections`, dedupe by id, order by set_id/position). Copying the
   existing per-feature pattern is expected; note the 3-way duplication in the
   evidence report as a future refactor candidate.
2. `filterCardsByMode(cards, filter)` — `applyLearningFilter` with
   `loadUncoveredIds("runner", ids)` + `loadWrongAnswerCardIds(ids)` (both
   reused from practice-coverage). `"random"` keeps the whole pool.
3. **Runner eligibility (TEMPORARY — to be replaced by the AI distractor
   task):** call RPC `load_runner_candidate_eligibility({ p_card_ids: ids })`
   via the authenticated client; keep only cards with `eligible === true`.
   If the RPC fails → friendly error.
4. `availableCounts = RUNNER_QUESTION_COUNTS.filter((c) => c <= eligibleCount)`.
   When `availableCounts.length === 0` → pool message:
   - if `filter === "unseen"` → `insufficientPoolMessage("unseen")`
   - if `filter === "wrong"` → `insufficientPoolMessage("wrong")`
   - else → "Không đủ thẻ hợp lệ để bắt đầu Runner."
   - Additionally, when cards were hidden by eligibility (pre-eligibility
     count > post-eligibility count) show notice: "Một số thẻ bị ẩn vì không
     đủ đáp án sai khác trong thư viện."

### `getRunnerAvailability(input)` → `{ ok, eligibleCount, eligibility: { availableCounts, message } }`

Runs the pipeline only (no writes). Used by the debounced setup effect.

### `startRunnerSession(input)` → `{ ok, session: { runnerSessionId, selectedCount, eligibleCount } } | { ok: false, error }`

- Runs the pipeline; if `availableCounts` does not include `questionCount` →
  return the pool message as error.
- Build the session plan with a NEW pure util `buildRunnerSession` (§5).
- `createAdminClient().rpc("create_runner_session", {
p_user_id: userId, p_session_card_ids, p_scope_card_ids,
p_difficulty: parsed.data.difficulty })`.
  - `p_session_card_ids` = the `questionCount` selected cards;
    `p_scope_card_ids` = all post-filter, post-eligibility card ids.
  - RPC error → friendly error (do not leak the SQL message).
- Return the runner session id. Do NOT call `load_runner_session_questions`
  here — the session page loads the payload (§2).

## 5. Pure selection util

`src/features/runner/utils/runner-session.ts`:

```ts
buildRunnerSession(cards: RunnerCard[], count: number, seededRandom: () => number, priority?: Set<string>): { sessionCardIds: string[]; selectedCount: number } | null
```

- Follows `match/utils/match-session.ts` shape: seeded random injected (from
  `node:crypto` `randomInt` at the action boundary, like Match), `"random"`
  mode passes a priority set of uncovered ids so uncovered cards come first.
- Returns `null` when `count > cards.length`.
- Reuse an existing pure `seededShuffle` from `src/features/study/utils/` if
  exported; otherwise implement a small pure shuffle with the injected random.
  Do not add `Math.random()` in production paths, and do not add dependencies.

## 6. Payload mapping (pure, unit-tested)

`src/features/runner/utils/map-runner-session-payload.ts`:

- `mapRunnerSessionRows(rows: unknown): RunnerQuestion[]` — validates the RPC
  output shape (Zod) and maps `flashcard_id`, `front`, `correct_answer`,
  `choices` (jsonb array of 3 strings) to the Task 2 `RunnerQuestion`.
- Zod payload schema `runnerSessionPayloadSchema` at the boundary: each row
  must have exactly 3 string choices and `correctAnswer` present in `choices`;
  invalid → throw (page catches and shows a friendly error).
- Note: `choices` from the RPC is already shuffled by the DB (seed = runner
  session id) — preserve the order, never reshuffle.

## 7. Setup UI

### `DifficultySelector` (NEW — `src/features/runner/components/difficulty-selector.tsx`)

- Client component, styled exactly like `ModeFilter` (fieldset, 3 segmented
  buttons, `aria-pressed`).
- Options: Dễ / Vừa / Khó; value + onChange props; default `"medium"`.
- Small helper text under the active option (or as a static row) showing
  lives + time per answer from `getRunnerDifficultyConfig`:
  e.g. `Dễ — 3 mạng · 6 giây/đáp án`, `Vừa — 2 mạng · 4 giây/đáp án`,
  `Khó — 1 mạng · 3 giây/đáp án`. Round 4200 → "4 giây" for display.

### `RunnerSetup` (client — `src/features/runner/components/runner-setup.tsx`)

Mirror `MatchSetup`:

- State: `all`, `selected` (Map), `filter` (default `"unseen"`), `count`
  (default 12), `difficulty` (default `"medium"`), availability
  (debounced 250 ms via `getRunnerAvailability`), errors, `pending`.
- Sections in the shared order: `ModeFilter` → `DifficultySelector` →
  `QuestionCountSelector` (options from `availableCounts`) → pool notice →
  `SourceBrowser` → error → `StickyStartBar`.
- Start button label: "Bắt đầu Runner"; pending label "Đang mở…".
- `start()`: call `startRunnerSession` directly; on `ok` →
  `router.push(\`/runner/session?sessionId=${sessionId}\`)`; on error → inline
  error (same pattern as Match).

## 8. Tests

### Unit (Vitest, `tests/unit/features/runner/`)

- `runner-schema.test.ts` — difficulty enum + default medium; count ∈
  {12,18,24}; the three source rules (all-vs-sources conflict, mixed areas,
  empty selection).
- `runner-session.test.ts` — `buildRunnerSession` picks exactly `count` cards;
  returns null when insufficient; seeded determinism with a fixed seed;
  random-mode priority puts uncovered first; never mutates input.
- `map-runner-payload.test.ts` — valid rows → `RunnerQuestion[]` with order
  preserved; rejects wrong shapes (≠3 choices, correctAnswer missing,
  non-string choices, missing fields).

### E2E (Playwright)

Update `tests/e2e/learning-mode-setup.spec.ts`:

- Test 1 ("Học page … no dead Runner route"): replace the 404 + no-link
  assertions with: Runner card is now a link with `href="/runner"`; the
  "Sắp ra mắt" badge is gone.
- Shared loops that iterate `["/quiz", "/match", "/memory"]` (mode filter,
  search/source-card, "All renders as first source card"): add `/runner`
  where the shared setup components exist.
- New spec `tests/e2e/runner-setup.spec.ts`:
  - Difficulty selector shows Dễ/Vừa/Khó, Vừa selected by default; helper
    text visible.
  - With ≥12 eligible cards (import the 24-card CSV fixture): counts 12/18/24
    offered, 12 default; start → URL `/runner/session?sessionId=...`; session
    page shows "Câu 1 / 12", difficulty label, and the first question front.
  - With 7 cards: no count buttons, Start disabled, pool message visible.
  - With duplicate backs (e.g., 3 cards sharing one back text + 1 card with a
    different back): eligibility notice visible and no startable count
    (deterministic case where no card has 2 distinct wrong answers).
  - `/runner/session` without `sessionId` → redirect to `/runner`.
  - Wrong-source URL (`/runner/session?sessionId=<random-uuid>`) → redirect
    to `/runner`.

Mobile viewport: the shared specs already use `{ width: 390, height: 844 }`
for these flows — keep that; assert no horizontal overflow on `/runner` and
`/runner/session` at 390px.

## 9. Doc sync (doc-only, explicitly allowed)

`docs/LEARNING_MODES.md` — two exact edits only:

1. In "Frozen Runner rules", add a bullet: `Question counts offered: 12 / 18 / 24 (matching Match and Memory).`
2. In "Explicitly unresolved for later stages", remove the bullet
   `Runner question count and session-selection UX.`

Do not touch the distractor/eligibility paragraphs (the AI task owns that).

## 10. Verification

```bash
npx vitest run tests/unit/features/runner
npm run check
```

E2E (requires local Supabase; use the repo's local E2E script per README —
`scripts/test-e2e-local.mjs`):

```bash
npx playwright test learning-mode-setup runner-setup
```

No DB test required (no database code changes).

## 11. Diff review

Before commit: `git status`, `git diff --check`, `git diff --stat`,
`git diff`. Check for:

- DB/migration changes (must be none)
- AI/Gemini imports (must be none)
- `Math.random()` outside the injected-seed boundary (must be none)
- Canvas/gameplay/HUD code (must be none — Task 4)
- React imports in pure utils; wall-clock in pure utils
- client-side reshuffling of prepared choices
- `user_id` accepted from the client (must be taken from server claims)
- changes to `mode-filter.tsx`, `question-count-selector.tsx`,
  `sticky-start-bar.tsx`, `source-browser.tsx` (must be none — reuse only)
- doc edits beyond the two listed in §9

## 12. Commit

Only after all gates pass:

```bash
git add src/features/runner src/app/\(app\)/runner src/app/\(app\)/study/page.tsx tests/unit/features/runner tests/e2e/runner-setup.spec.ts tests/e2e/learning-mode-setup.spec.ts docs/LEARNING_MODES.md
git commit -m "feat: add runner setup and session wiring"
```

Push is allowed only if: baseline is on origin/main, all gates pass, no
unexpected shared-system change occurred (note: `study/page.tsx` is a shared
page — its only change must be the Runner card link). If anything suspicious:
do not push.

## 13. Evidence report

Return:

### Repository

- starting commit, final commit, push status, worktree

### Flow

- setup → availability → start → session creation → payload load (trace each
  step with file paths)

### Reused vs new

- list every shared component/util reused (no modification) and every new file

### Tests

- exact files, discovered, passed, failed, skipped (unit + E2E)

### Files changed

- each file and purpose

### Safety

- migrations changed NO; DB changed NO; dependencies changed NO; env changed
  NO; AI/live API NO; production accessed NO; docs changed YES (scope: §9)

### Ambiguities

- any unresolved issue

### Verdict

- `EVIDENCE READY FOR REVIEW` or `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
