# Flashcard Runner V1 — Task 2: deterministic gameplay core

> **Status:** verified (2026-08-14) — agent xong, đã đối chiếu với repo
> **Final commit:** `526e0ef` (`feat: add runner gameplay core`) — đã push lên origin/main
> **Verification:** 47/47 unit tests pass (chạy lại); `tsc --noEmit` sạch; eslint sạch trên file mới; diff đúng scope (6 file code/test + doc đã chốt, không đụng DB/UI/deps/env)
> **Baseline commit:** `08b4761` (`chore: consolidate runner database migration`)
> **Agent tier:** OpenCode + DeepSeek V4 Pro (chính); Codex + GPT-5.6 Terra (review tùy chọn)
> **Decisions locked (user):**
>
> - 1-A: Freeze timing `easy 6000ms / medium 4200ms / hard 3000ms` + sync `docs/LEARNING_MODES.md`
> - 2-A: Chống double-fire event bằng `itemSeq` (HIT/PASS kèm seq; reducer bỏ qua seq cũ)
> - 3-A: Jump state **giữ nguyên airborne** khi chuyển câu (không reset grounded)
>   **Doc sync:** `docs/LEARNING_MODES.md` đã sửa 4 chỗ (timing freeze, persistence, distractor-resolution, unresolved list) — chưa commit, agent Task 2 sẽ commit kèm nếu `git status` còn hiển thị modified.
>   **Files:** `src/features/runner/` + `tests/unit/features/runner/` (chưa tồn tại khi giao)

---

## 0. Before starting

Task 1 is committed and verified on `main` at baseline
`08b4761 chore: consolidate runner database migration` (or a strictly newer
commit). Before changing anything run:

```bash
git status
git log -8 --oneline
git pull --ff-only
```

Confirm `main` is up to date and no `src/features/runner/` exists yet.
Note: `docs/LEARNING_MODES.md` may already show as modified in `git status` —
that is the product owner's pre-synced timing freeze; verify it matches §9 and
do not edit the doc further in this task.

Read the current Runner contracts before choosing file names:

- `docs/LEARNING_MODES.md` — "Flashcard Runner" + "Frozen Runner rules"
- `supabase/migrations/20260813020000_add_runner_database_foundation.sql` —
  the session/question contract (`load_runner_session_questions`,
  `runner_sessions`, `runner_personal_bests`)
- `src/features/memory/utils/memory-state.ts` +
  `tests/unit/features/memory/memory-state.test.ts`, and
  `src/features/match/utils/match-state.ts` — the pure-state conventions this
  task must follow
- `src/features/spaced-repetition/config.ts` — the config-module convention

If repository reality conflicts with the frozen rules below:
**STOP and ask the user.** Do not invent behavior.

## 1. Scope

Build a pure, deterministic Runner gameplay core (types + pure functions +
constants). It must know:

- current question index, total question count, completed count
- current active answer index (which of the 3 choices is the visible food)
- lives
- elapsed active play time (integer ms)
- jump state (grounded/airborne)
- pause/resume state
- transient correct/wrong feedback token
- terminal states (game-over / completed)

It must NOT know about: React, Canvas, DOM coordinates, database, Supabase,
sound, images, CSS, navigation, animation frames, browser APIs, wall clock.

## 2. Input question contract

The engine receives a fully prepared, immutable question payload — the same
shape produced by `load_runner_session_questions`:

```text
RunnerQuestion {
  flashcardId: string
  front: string
  correctAnswer: string
  choices: [string, string, string]   // exactly 3, ALREADY shuffled by the DB
}
```

Frozen facts:

- Exactly 3 choices per question: 1 correct + 2 canonical wrong answers.
- The DB already shuffles the 3 choices deterministically (md5 ordering seeded
  by the runner session id). **The engine must preserve the prepared choice
  order. Do not reshuffle.**
- `correctAnswer` is textually one of the 3 `choices`. The engine derives
  `correctIndex = choices.indexOf(correctAnswer)` once at creation and stores
  it; if not found, the payload is invalid (throw).
- The complete payload is loaded once at game start and retained for the run.
  The engine never refetches questions and never calls Quiz, DB, or RPC code.

## 3. Frozen gameplay rules

Per question: 3 choices, exactly 1 active food at a time. Active answer cycles
A → B → C → A → … indefinitely.

## 4. Skipping food

`PASS_ACTIVE_ITEM` (the food left the play area without being touched): current
food disappears, active answer advances to the next choice in the cycle.
Skipping never costs a life, never completes the question, and never ends the
game.

## 5. Correct hit

`HIT_ACTIVE_ITEM` on the choice whose index equals `correctIndex`:

- transient correct feedback (must not block progression)
- food disappears immediately; question completed; `completedCount += 1`
- advance to the next question: `questionIndex += 1`, `activeAnswerIndex = 0`
  (first choice of the new question's prepared order), new item instance
- lives unchanged; elapsed unchanged; jump state unchanged
- if it was the final question → status `completed`, no active answer
  (`activeAnswerIndex = null`)

## 6. Wrong hit

`HIT_ACTIVE_ITEM` on any other choice:

- transient wrong feedback (must not block progression)
- food disappears immediately; `lives -= 1`
- stay on the SAME question; progress unchanged
- if lives remain: active answer advances to the next choice in the cycle
  (new item instance), gameplay continues immediately
- if lives reach 0: status `game-over` immediately; no new active answer is
  spawned

## 7. Game over

Wrong hit reduces lives to 0 → `game-over`. No active answer. No coverage
completion, no best-time write (those belong to later UI/server tasks).

## 8. Completed

Correct hit on the final question with lives remaining → `completed`. No
active answer. Coverage completion, best-time submission, and result rendering
belong to later tasks.

## 9. Difficulty

Frozen configuration (single constants boundary — do not scatter):

```text
easy   → lives 3, timePerItemMs 6000
medium → lives 2, timePerItemMs 4200
hard   → lives 1, timePerItemMs 3000
```

- Difficulty changes ONLY the timing parameter and the frozen life count. No
  other mechanics differ (no jump height, gravity, answer count, scoring, or
  question-rule changes).
- These values are product-owner frozen; `docs/LEARNING_MODES.md` has already
  been updated to match (verify while reading, do not edit).

## 10. Timing model

The future HUD timer counts UP. The core tracks `elapsedMs` (integer) — active
play time only:

- accrues only while `status === "playing"`
- never accrues in `ready`, `paused`, `game-over`, `completed`
- paused duration is excluded; resume restores the exact pre-pause state
- no `Date.now()` / wall clock anywhere in the reducer — time enters
  exclusively via `TICK { deltaMs }`

## 11. Pause / resume

Frozen product rule: backgrounding the tab/app pauses the game and the
completion timer; returning resumes. Task 2 implements ONLY the pure `PAUSE` /
`RESUME` transitions. No `visibilitychange` or any browser listener — that
belongs to the later React/session adapter.

While paused: food progression must not advance; HIT/PASS/JUMP/LAND must not
alter the run; TICK must not increase `elapsedMs`.

## 12. Ready state

Explicit `ready` status before gameplay. `START` → `playing`. Elapsed timing
begins only at `START` (the first item instance is created on START).

## 13. State model

```text
status:       "ready" | "playing" | "paused" | "game-over" | "completed"
feedback:     { kind: "correct" | "wrong"; questionIndex: number; itemSeq: number } | null
jumpState:    "grounded" | "airborne"
```

Plus: `questions`, `questionIndex`, `activeAnswerIndex: number | null` (null in
`ready`/`game-over`/`completed`), `itemSeq` (monotonic per active-item
instance), `correctIndexes` (derived once), `lives`, `completedCount`,
`elapsedMs`.

`correct-hit`/`wrong-hit` are NOT statuses — feedback is a separate transient
field so gameplay never blocks. Feedback is set only by HIT events;
PASS/TICK/JUMP/LAND/PAUSE/RESUME never modify it; the next HIT overwrites it.
The renderer uses `feedback.itemSeq`/`questionIndex` to key visual effects and
expires them itself (rendering concern, not core state).

## 14. Duplicate-event safety

Browser/input behavior can occasionally double-fire events. The core must be
defensive:

- `HIT_ACTIVE_ITEM` and `PASS_ACTIVE_ITEM` events carry the `itemSeq` of the
  item instance the caller observed.
- The reducer ignores the event unless `event.itemSeq === state.itemSeq`.
- Every time the active item changes (START, pass, wrong-hit advance,
  correct-hit advance) `itemSeq` increments; on `completed`/`game-over` no new
  item is created.
- Terminal states are stable: `completed`/`game-over` ignore every event.
- `paused` ignores every gameplay event.

This guarantees one logical correct hit can never advance two questions: the
duplicate event carries the old `itemSeq` and is ignored.

## 15. Answer index behavior

Choices are indexes 0..2. Active answer progresses 0 → 1 → 2 → 0 on pass and on
wrong-hit-with-lives-remaining. Correct hit moves to the next question instead
(active answer resets to index 0 of the new question's prepared order). Add a
tiny pure helper `nextAnswerIndex(index)` if useful — do not over-abstract.

## 16. Question progress

Track `questionIndex` (0-based), total = `questions.length`, and
`completedCount`. Wrong answers and skips never increment progress. Do not
invent XP/score.

## 17. Jump behavior

Single jump only — no double jump. The pure core tracks only logical
eligibility:

```text
grounded + JUMP → airborne (accepted)
airborne + JUMP → ignored
airborne + LAND → grounded
grounded + LAND → no-op
```

- `JUMP`/`LAND` in `ready`/`paused`/terminal are no-ops.
- Jump state is NOT reset on question change (a correct hit mid-air stays
  airborne into the next question; resetting would grant a free second jump).
- Pixel physics (y, velocity, gravity, collision geometry) belong to the later
  Canvas runtime, not this reducer.

## 18. Collision interpretation

Task 2 does not compute rectangles/pixels. Later Canvas code decides whether
the player hit or passed the active food and dispatches the semantic events.
The core consumes only these.

## 19. Feedback events

Correct/wrong hits need later visual effects (green/red). The core exposes
`feedback` (see §13). Feedback never stops gameplay.

## 20. Empty/invalid input

`createRunnerState` must fail safely:

- 0 questions → throw (never silently create a completed game)
- any question with `choices.length !== 3` → throw
- `correctAnswer` not present in `choices` → throw
- invalid difficulty → throw

## 21. Pure API design

Follow the repository's pure-function convention (see `memory-state.ts` /
`match-state.ts` — no classes, no mutable singletons, no global timers, no
React imports):

```ts
createRunnerState(questions: RunnerQuestion[], difficulty: RunnerDifficulty): RunnerState
applyRunnerEvent(state: RunnerState, event: RunnerEvent): RunnerState
getRunnerDifficultyConfig(difficulty: RunnerDifficulty): RunnerDifficultyConfig
calculateRunnerSpeed(distancePx: number, timePerItemMs: number): number
```

`applyRunnerEvent` returns the input state reference unchanged for no-ops
(helps the adapter skip re-renders). Naming may follow repository conventions,
but the contracts above are fixed.

## 22. Events

```ts
type RunnerEvent =
  | { type: "START" }
  | { type: "JUMP" }
  | { type: "LAND" }
  | { type: "PASS_ACTIVE_ITEM"; itemSeq: number }
  | { type: "HIT_ACTIVE_ITEM"; itemSeq: number }
  | { type: "TICK"; deltaMs: number }
  | { type: "PAUSE" }
  | { type: "RESUME" };
```

Do not add gameplay events beyond what frozen V1 behavior requires.

## 23. Time handling

`TICK.deltaMs` is the only time input; the reducer never reads the wall clock.

- `deltaMs` must be a finite number ≥ 0. Negative, `NaN`, or `±Infinity` →
  event ignored (state unchanged).
- Non-integer values are floored (`Math.floor`) before accumulation;
  `elapsedMs` is always an integer (the best-time RPC contract takes integer
  ms).

## 24. Time-per-item

Difficulty provides `timePerItemMs`. The later Canvas adapter derives movement
speed = playable distance / timePerItemMs. Expose the pure helper
`calculateRunnerSpeed(distancePx, timePerItemMs)`:

- returns `distancePx / timePerItemMs`
- throws on non-positive / non-finite `distancePx` or `timePerItemMs`

No browser resize handling in this task.

## 25. No answer auto-expiry in the domain

`timePerItemMs` is NOT a domain timeout. The Canvas runtime knows when the food
physically left the play area and dispatches `PASS_ACTIVE_ITEM`. The core never
schedules food expiry — one clock only.

## 26. Event × state matrix (authoritative)

| Event            | ready                                                 | playing                                                       | paused    | game-over / completed |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------- | --------- | --------------------- |
| START            | → playing (creates first item, only if questions > 0) | no-op                                                         | no-op     | no-op                 |
| JUMP             | no-op                                                 | grounded→airborne; airborne→no-op                             | no-op     | no-op                 |
| LAND             | no-op                                                 | airborne→grounded; grounded→no-op                             | no-op     | no-op                 |
| PASS_ACTIVE_ITEM | no-op                                                 | seq mismatch → no-op; else advance to next answer (itemSeq+1) | no-op     | no-op                 |
| HIT_ACTIVE_ITEM  | no-op                                                 | seq mismatch → no-op; correct → §5; wrong → §6                | no-op     | no-op                 |
| TICK             | no-op                                                 | accumulate floored deltaMs                                    | no-op     | no-op                 |
| PAUSE            | no-op                                                 | → paused                                                      | no-op     | no-op                 |
| RESUME           | no-op                                                 | no-op                                                         | → playing | no-op                 |

## 27. Unit tests — mandatory

Under `tests/unit/features/runner/` (import via `@/features/runner/...`), with
Vitest — no new dependencies. Directly prove:

**Initialization** — easy/medium/hard lives (3/2/1); timing constants
(6000/4200/3000); correctIndex derived; valid initial question index 0;
0 questions rejected; question with ≠ 3 choices rejected; correctAnswer-not-
found rejected; invalid difficulty rejected.

**Start** — ready → playing; elapsedMs stays 0 before START; first active
answer is index 0 with itemSeq 0.

**Answer cycle** — A pass → B; B pass → C; C pass → A; multiple full cycles
work; pass never changes lives; pass never completes the question.

**Correct** — correct active hit advances exactly one question; lives
unchanged; completedCount +1; next question starts at its first prepared
answer with a new itemSeq; final correct → completed with
`activeAnswerIndex === null`; jump state preserved across the question change.

**Wrong** — wrong hit loses exactly 1 life; same question; progress unchanged;
next answer appears (new itemSeq); still playing if lives remain.

**Game over** — wrong hit at 1 life → 0 → game-over; `activeAnswerIndex ===
null`; no further gameplay event changes progress/lives/elapsed.

**Skip** — no lives change, no completion.

**Pause** — playing → paused; TICK in paused does not increase elapsedMs;
HIT/PASS/JUMP/LAND in paused do nothing; RESUME → playing; paused duration
excluded from elapsedMs.

**Timer** — deterministic integer accumulation; negative/NaN/Infinity delta
ignored; completed/game-over time frozen; TICK in ready does not accrue.

**Jump** — grounded jump accepted; second jump while airborne ignored; LAND →
grounded; subsequent jump accepted; jump state survives question change;
JUMP/LAND no-ops in ready/paused/terminal.

**Duplicate-event safety** — a second HIT with the previous itemSeq
(double-fire of one logical correct hit) is ignored: exactly one question
advances; a second PASS with the previous itemSeq is ignored; terminal states
ignore HIT/PASS/JUMP/LAND/TICK.

**Feedback** — correct/wrong feedback set with questionIndex + itemSeq;
PASS/TICK/JUMP never modify feedback; next HIT overwrites it.

**Difficulty helper** — `getRunnerDifficultyConfig` returns the frozen values;
`calculateRunnerSpeed` correct math; invalid dimensions rejected.

## 28. Property/invariant-style tests

Concise Vitest loops/table tests (no property-testing dependency): lives never
< 0; questionIndex always within range; answerIndex always 0..2 while playing;
completedCount never decreases; elapsedMs never decreases; wrong hit never
advances the question; pass never changes lives.

## 29. No DB changes

```text
migrations changed: NO
database schema changed: NO
generated Supabase types changed: NO
```

If Task 2 turns out to need a DB change: **STOP and ask.** Do not create one.

## 30. No UI/Canvas

No `/runner` routes, no Canvas components, no HUD, no result UI, no buttons,
no asset files, no CSS, no navigation changes, no E2E gameplay tests.

## 31. No AI

Fully deterministic. No Gemini, no AI APIs, no live external APIs.

## 32. Expected files

```text
src/features/runner/
  config.ts                      frozen difficulty constants (precedent: src/features/spaced-repetition/config.ts)
  types/runner-types.ts          RunnerQuestion, RunnerDifficulty, RunnerDifficultyConfig, RunnerState, RunnerEvent, Feedback, JumpState
  utils/runner-state.ts          createRunnerState, applyRunnerEvent, nextAnswerIndex
  utils/runner-difficulty.ts     getRunnerDifficultyConfig, calculateRunnerSpeed
tests/unit/features/runner/
  runner-state.test.ts
  runner-difficulty.test.ts
```

Follow repo conventions rather than blindly copying these names. Do not create
unnecessary directories.

## 33. Verification

Run the focused Runner unit tests first:

```bash
npx vitest run tests/unit/features/runner
```

Then the full gate:

```bash
npm run check
```

E2E is not required (no user flow wired, no routes added; the existing
`/runner` → 404 E2E must stay green). If any shared production code outside
`src/features/runner/` is modified, run the relevant regression tests. No DB
tests required (no database code changed).

## 34. Diff review

Before commit: `git status`, `git diff --check`, `git diff --stat`,
`git diff`. Check for:

- DB changes (must be none)
- React imports / browser globals in pure domain code
- `Date.now()` / wall clock in the reducer
- `Math.random`, `setInterval`, `setTimeout`, `requestAnimationFrame`
- mutable singleton state
- missing `itemSeq` on HIT/PASS events
- any reshuffling of prepared choices
- unrelated refactors; accidental UI; hidden gameplay assumptions
- doc edits (must be none — `docs/LEARNING_MODES.md` was pre-synced)

## 35. Commit

Only after all gates pass:

```bash
git add src/features/runner tests/unit/features/runner
```

If `docs/LEARNING_MODES.md` shows as modified in `git status` (the product
owner's pre-synced timing freeze), stage and include it in this commit:

```bash
git add docs/LEARNING_MODES.md
git commit -m "feat: add runner gameplay core"
```

Push is allowed only if: baseline is on origin/main, all gates pass, no
unexpected shared-system change occurred. If anything suspicious: do not push.

## 36. Evidence report

Return:

### Repository

- starting commit, final commit, push status, worktree

### Gameplay model

- states, events, question cycling, wrong/correct behavior, lives, timer,
  pause, jump, duplicate-event safety

### Difficulty

- Easy 3 / 6000; Medium 2 / 4200; Hard 1 / 3000

### Tests

- exact files, discovered, passed, failed, skipped
- direct evidence for: A→B→C→A; wrong stays same question; correct advances
  one; final correct completes; zero lives game-over; paused timer; no double
  jump; terminal states ignore further gameplay; stale-itemSeq duplicate
  events ignored

### Files changed

- each file and purpose (including `docs/LEARNING_MODES.md` if committed)

### Safety

- migrations changed NO; DB changed NO; dependencies changed NO; env changed
  NO; production accessed NO; live API NO; docs changed NO (pre-synced)

### Ambiguities

- any unresolved issue

### Verdict

- `EVIDENCE READY FOR REVIEW` or `INCOMPLETE — BLOCKER REQUIRES USER DECISION`
