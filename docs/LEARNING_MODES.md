# Phase 5 — Learning modes foundation

Phase 5 adds practice and play modes around the existing flashcard domain. This
document freezes the product rules and records the current Quiz boundary that
future implementation stages must reuse. Phase 5A adds no route, UI, game loop,
database table, migration, or persistence.

## Mode map

| Group    | Mode             | Purpose                       | Learning-data effect in Phase 5              |
| -------- | ---------------- | ----------------------------- | -------------------------------------------- |
| Learning | Traditional Quiz | Graded recall                 | Existing behavior plus `quiz` coverage.      |
| Learning | Match            | Fast Front → Back recognition | Practice-only plus `match` coverage only.    |
| Play     | Memory Matching  | Find Front ↔ Back pairs       | Future practice-only `memory` coverage only. |
| Play     | Capy Runner      | Educational runner game       | Future practice-only `runner` coverage only. |

Match, Memory Matching, and Capy Runner must not update FSRS schedules,
Mastery, `card_review_events`, `quiz_sessions`, `daily_learning_records`,
streaks, or statistics. Their mode-specific coverage write after whole-session
completion is selection-cycle state only, not graded learning data. Whether
practice/game activity later affects streaks or general statistics remains a
product decision for a later phase.

## Shared setup UI and information architecture

The session-based modes share one mobile-first setup structure and visual
language. Presentation is shared; each feature keeps its own session
construction and side-effect boundary.

### Information architecture

- **Học** (`/study`): two top tabs — **Học truyền thống** (the existing Study
  flow) and **Vừa học vừa chơi** (play mode cards). Memory Matching and Capy
  Runner are functional links to their respective setup routes.
- **Kiểm tra** (`/quiz` and `/match`): one shared top tab control —
  **Trắc nghiệm** (existing Quiz) and **Match** (existing Match). `/quiz` keeps
  its Tạo bài / Lịch sử sub-tabs; `/match` shows only the Match setup.

### Shared setup order

1. Mode tabs / page context
2. Chế độ (shared mode filter)
3. Số câu (shared count selector)
4. "Chọn một hoặc nhiều nguồn" (single heading)
5. Search
6. Source-area filter (Tất cả / Bộ thường / Bộ đặc biệt)
7. Source cards (the **last** normal content section; "Tất cả N thẻ" is the
   first source card)
8. Sticky Start CTA

### Shared mode filter

Only three filters exist: **Chưa làm**, **Câu sai**, **Ngẫu nhiên**. "Cân bằng"
is no longer exposed to users (the Quiz engine keeps its internal balanced
ordering as the fallback for the other modes). Traditional Study never shows
these filters. Each filter defines a **strict eligible pool** over the selected
source scope; the setup UI never backfills.

- **Chưa làm** — the mode-specific uncovered pool. Quiz uses cards uncovered
  for `mode = 'quiz'`; Match uses `mode = 'match'`; Memory uses `mode =
'memory'`. Insufficient coverage never backfills covered cards.
- **Câu sai** — the canonical shared wrong-answer history (completed Quiz
  sessions' incorrect answers). Match and Memory reuse this same set and never
  create their own wrong history. Cards that were never wrong are not added.
  Selecting "Câu sai" only changes which cards may be selected; it does not
  make Match/Memory graded.
- **Ngẫu nhiên** — the entire valid selected pool, still ordered with coverage
  fairness so repeated sessions eventually cover the whole pool instead of
  repeating the same small subset.

The shared filter maps to the existing Quiz RPC modes: Chưa làm →
`never_tested`, Câu sai → `wrong_answers`, Ngẫu nhiên → `pure_random`. For
Match and Memory the filter is applied as a strict pool filter before their
session builders run.

### Question counts

- **Quiz** offers the fixed counts `10 / 20 / 30 / 50` (only those strictly
  below the strict pool N) plus **"Tất cả N"** where N is the strict eligible
  pool after applying the source scope and filter. When N equals a fixed count,
  only "Tất cả N" is offered. "Tất cả N" is Quiz-only and is the only way to
  start a manual Quiz below 10 questions: for `1 <= N < 10` the session is
  created with exactly N questions, and `N = 0` cannot start.
- **Match** and **Memory** offer `12 / 18 / 24` only, enabled when the strict
  pool can construct that session under the existing six-pairs-per-batch and
  content-feasibility rules. They never show "Tất cả N" and never pad the pool.

### Insufficient pool

When no session size is possible, the sticky Start CTA is disabled and a
filter-specific message is shown: "Không đủ thẻ chưa làm để bắt đầu." for Chưa
làm, "Không đủ câu sai để bắt đầu." for Câu sai, and an empty-state message
when the pool is zero.

## Shared learning-mode coverage (Phase 5C.0)

Coverage answers only: **has a flashcard been included in the current selected
cycle for this mode?** It is not scheduling. FSRS alone remains responsible for
stability, difficulty, retrievability, due dates, Smart Review, and New Cards.

- Identity is `user + mode + flashcard`; valid modes are `quiz`, `match`,
  `memory`, and `runner`. A Match-covered card is still Memory-uncovered, and
  vice versa.
- Study, Smart Review, and New Cards do not read or write coverage.
- Coverage commits only after a whole session completes. Starting, abandoning,
  or partly completing a session changes no coverage state.
- A server-created durable coverage session snapshots both its selected cards
  and its eligible source scope. Completion takes only its opaque ID and is
  atomic and idempotent; retries return the first result without polluting a
  new cycle.
- When all surviving cards in that snapshotted selected scope are covered, only
  that scope is reset for that mode. Rows outside the scope stay unchanged.
  Deleted snapshot cards are safely ignored at completion because they can no
  longer be covered.
- `covered_at` is the first coverage time in the current cycle. A reset deletes
  rows; a later re-cover creates a new timestamp.

### Source selection

The source taxonomy remains unchanged:

- **Tất cả thẻ** is standalone and exclusive.
- **Bộ thường** supports multi-select within that area.
- **Bộ đặc biệt** supports multi-select within that area.
- Regular sets and special collections cannot be mixed. Switching areas clears
  the incompatible selection.

Each selected scope is the union of its card IDs, so an overlapping card appears
once. The same source rules apply to Traditional Quiz and Match. Traditional
Quiz prioritizes currently uncovered `quiz` coverage before its existing
historical balancing criteria; Smart Review and New Cards retain their own
selection paths.

Future Memory and Runner use the same server contract: create a mode-specific
coverage session from a source selection and question count, then complete the
opaque session ID only after a legitimate full game completion.

## Current Quiz question foundation

Quiz question snapshots are created only by database functions:

- `public.create_quiz_session(...)` creates a manual source-scoped Quiz.
- `public.create_quiz_session_from_card_ids(uuid[])` creates an explicit-target
  snapshot used behind trusted Smart Review and New Cards wrappers.

Each `quiz_questions` snapshot stores the target `source_flashcard_id`, `prompt`
(Front), `correct_answer` (Back), ordered `choices`, and the
`correct_choice_index`. Only target cards become questions. In explicit-target
sessions, other owned active cards may be distractors, but distractor appearance
does not itself produce a review event.

The canonical distractor operation currently lives in those PostgreSQL
session-creation functions. For each target it:

1. keeps the target Back as the correct candidate;
2. normalizes Back values with `lower(regexp_replace(btrim(back), '\\s+', ' ', 'g'))`;
3. excludes the normalized correct value;
4. de-duplicates distractors with `distinct on` that normalized value;
5. takes up to three wrong answers (`limit 3`);
6. orders candidates from session-derived MD5 values before storing `choices`.

The database accepts two through four choices. Normal Quiz therefore stores one
correct answer plus up to three distinct wrong answers; it rejects a question
only when fewer than two total choices exist. Normal source-scoped quizzes use
their chosen source scope for distractors; the explicit-card primitive uses the
owner's active library. This difference is existing Quiz behavior and must not
be changed casually.

### Runner reuse limitation

Capy Runner reuses the canonical Quiz normalization, correct-answer exclusion,
normalized de-duplication, and deterministic MD5 ordering rules rather than a
client-side distractor algorithm. It needs exactly three candidates: one correct
and two wrong. Its wrong answers are deliberately restricted to the other cards
in its immutable Runner session snapshot, so each question remains grounded in
the selected session rather than the user's whole library. The session id and
target flashcard id provide a deterministic per-question seed.

The current Quiz rule also permits a target with only one unique wrong answer,
which yields two total choices. Consequently, Runner cannot guarantee its three
unique candidates for every selected scope. Runner V1 resolves the insufficient
case deterministically: `load_runner_candidate_eligibility` rejects cards
without two distinct canonical wrong answers among the supplied scope,
`create_runner_session` revalidates the actual selected session snapshot
atomically, and `load_runner_session_questions` fails the whole load (errcode
`22023`) when a snapshotted card cannot form exactly three distinct choices. It
never invents placeholder or duplicated answers.

## Side-effect boundary

Question/session construction and graded persistence are deliberately separate
concerns, but the current Quiz constructor persists a Quiz snapshot. The only
graded side-effect path is:

```text
Quiz UI
  → submitQuizAnswer server action
  → submit_quiz_answer(question_id, selected_choice_index) RPC
  → answered quiz question + immutable card_review_event
  → completed Quiz session + daily_learning_records (on final answer)
  → best-effort FSRS reconciliation after the authoritative transaction
```

The answer RPC derives correctness from the stored correct index. It appends the
immutable Quiz review fact with `fsrs_rating = Good (3)` for correct or
`Again (1)` for incorrect; retries return the existing fact rather than editing
history. Mastery is derived from review history on read, never directly written
by an answer or practice-mode data load.

Future Match, Memory, and Runner must use read-only card/question data and must
not call the Quiz answer RPC or create a Quiz session simply to obtain options.
Their eventual data contract must be side-effect free and keep option generation
separate from session/grading persistence.

## Randomness

Quiz candidate ordering is deterministic per newly created session through the
SQL MD5 ordering above. Study has the existing pure `seededShuffle(items, seed)`
utility for reproducible session order. Future practice/game code must not spread
ad-hoc `Math.random()` calls through React components. If a later concrete mode
needs a shuffle helper, it should be pure and accept an injectable/testable
random source or session seed.

## Match (Phase 5B — implemented)

- Pairs are Front ↔ Back for fast recognition practice.
- Match is practice-only and must not affect FSRS, Mastery, `card_review_events`,
  `quiz_sessions`, `daily_learning_records`, streaks, or statistics.

### Interaction

Front → Back only. Two columns:

- LEFT: Front cards.
- RIGHT: Back cards.

Each column is independently shuffled. The user taps a Front, then taps the
corresponding Back:

- **Correct:** both cards become visually faded/muted, remain in their exact
  positions, and become non-interactive. The layout does not collapse/reflow.
- **Incorrect:** subtle red feedback, the attempted selection clears, no score
  penalty, no life penalty, the user continues immediately.

Correctly matched cards are never removed from the layout.

### Fixed batch size

Every Match batch contains exactly **6 flashcard pairs** (12 interactive cards
before matches complete). The batch size does not adapt.

### Session question counts

The user can choose only **12 / 18 / 24**:

- 12 flashcards → 2 batches × 6 pairs
- 18 flashcards → 3 batches × 6 pairs
- 24 flashcards → 4 batches × 6 pairs

### Eligibility

| Constructible unambiguous pairs | Allowed counts     |
| ------------------------------- | ------------------ |
| < 12                            | Match cannot start |
| 12–17                           | 12                 |
| 18–23                           | 12, 18             |
| ≥ 24                            | 12, 18, 24         |

Availability is determined from the actual card set, not the raw physical card
count: Match requires enough cards to construct complete unambiguous six-pair
batches for the offered session size. No partial batch is created, and
previously played cards are never reused to fill a batch.

### Session card selection

If the set contains more eligible cards than the selected count, cards are
selected **randomly for each new Match session** without replacement. A replay is
a new session, so selection may be randomized again. Underlying flashcard
ordering is never mutated.

### Duplicate / ambiguity prevention

Within every six-card batch:

- Front values are unique after canonical normalization
  (trim + collapse whitespace + lowercase).
- Back values are also unique after canonical normalization.

The canonical normalization mirrors the existing Quiz distractor normalization
(`lower(regexp_replace(btrim(back), '\s+', ' ', 'g'))`) so Match treats content
exactly as Quiz does for option distinctness. Normalization is used only for
ambiguity detection — rendered text remains the user's original content.
Conflicting cards are skipped/reselected during batch construction. If the
available set cannot produce the requested number of complete unambiguous
batches, that count option is not offered. A flashcard is never reused twice in
the same session.

### Randomization

Randomization happens at two levels:

1. Session selection — random eligible cards.
2. Every batch — Front order and Back order are shuffled independently, so the
   correct Front/Back normally appear at unrelated positions.

Randomization uses a pure seeded PRNG (mulberry32) seeded once per session, so a
session is reproducible from its seed while each new session/replay draws a new
seed. No `Math.random()` is scattered through UI components.

### Batch progression

A Match session has 2, 3, or 4 six-card batches. When all six pairs in the
current batch are matched, the session automatically continues to the next
batch — no "Next batch" button, no intermediate modal. Overall session progress
is maintained. No batch progress is persisted in Phase 5B.

### Completion screen

After all selected pairs complete, a minimal completion state shows:

- "Hoàn thành N/N" using the actual selected count.
- Actions: "Chơi lại" (new session, same count, new random selection/shuffle) and
  "Quay lại" (returns to the study/learning-mode selection).
- No score, percentage, leaderboard, streak, XP, mastery, or FSRS data.

### Typography and long text

Match uses one fixed readable body-text token (`text-sm`/`text-base`) for all
cards during a session. Cards do not shrink individually and text is never
truncated or hidden behind ellipsis. Cards wrap and may grow vertically; the
page allows moderate vertical scrolling. The two columns use most of the useful
content width, with no horizontal scroll.

### Entry point

Match is reached from the "Học" (`/study`) page via a Match link. It reuses the
existing source-selection browser for choosing which flashcards to practice.
"Trắc nghiệm" (Quiz) remains available through its existing route.

### Side-effect boundary

Match creates a durable coverage-session snapshot at start and writes only
`match` coverage after the whole selected session completes. It creates no
`quiz_sessions`, no quiz answers, no `card_review_events`, no FSRS scheduling,
no mastery updates, no `daily_learning_records`, no streak/statistics changes,
and no game-result persistence.

### Accessibility

- Semantic interactive controls with visible keyboard focus.
- Selected state exposed via `aria-pressed`.
- Matched/disabled cards are non-interactive (`disabled`) and communicate state
  with opacity plus semantic disabled state, not color alone.
- Error feedback is text-based and respects `prefers-reduced-motion`.
- Clear section/title structure for screen readers.

## Memory Matching (Phase 5C.1 — implemented)

Memory is a practice/game mode reached from the "Học" page under a "Chơi"
section (`/memory`). It reuses the shared source-selection browser and the Phase
5C.0 mode-specific coverage foundation (`mode = "memory"`).

- **Game:** Front ↔ Back pairs by stable flashcard identity (never text
  equality). Exactly six flashcards per batch (12 tiles) in an adaptive grid
  that picks its columns/rows from the available viewport (for example 3×4,
  4×3, or 6×2) so all 12 tiles stay visible in one screen without page
  scrolling. Session choices are 12 / 18 / 24 (2 / 3 / 4 batches).
- **Tiles:** Face-down tiles are blank light-blue buttons with no text. A
  flipped tile shows only an upward-arrow icon on a different light background;
  no flashcard text ever appears inside a tile.
- **Preview:** A region above the grid shows only the most recently flipped
  tile's full original content. Long text wraps and the preview scrolls
  vertically rather than shrinking or ellipsizing.
- **Correct pair:** The pair stays flipped for exactly 1000 ms so the user can
  read the second tile's preview; interaction is locked during that window.
  After the delay the pair fades, becomes disabled, and lightweight CSS
  confetti shows in the preview for roughly 700 ms (disabled under
  `prefers-reduced-motion`). After the final pair of a batch, the next batch
  advances automatically.
- **Mismatch:** No tile turns red. The preview gets a subtle red border for
  exactly 1000 ms, then both tiles flip face-down and the preview returns neutral.
  There is no penalty or "Sai" copy.
- **Timer:** One whole-session timer starts when the first batch is active and
  stops at the logical final-pair match (the moment the final correct pair is
  detected), excluding the 1000 ms review delay and the celebration animation.
  It is not persisted.
- **Coverage:** A durable coverage session is created at start and `memory`
  coverage commits only after the whole session completes. Replay re-queries the
  server for the latest coverage and creates a fresh opaque session.
- **Practice-only:** No Quiz, FSRS, mastery, review-event, or statistics writes.
  It remains mobile-first (390×844) with no horizontal overflow.

## Capy Runner

Runner uses a React shell plus an HTML5 Canvas runtime and
`requestAnimationFrame`. It must not introduce Phaser, Pixi, Unity, or another
dedicated game engine.

React owns setup, question/current-answer text, lives, difficulty, progress, and
results. The Canvas runtime owns continuous runner animation, food movement,
jump physics, educational collision detection, visual effects, and the frame
loop. Educational/game state should stay independently testable from rendering
where practical.

### Frozen Runner rules

- Easy starts with 3 hearts, Medium with 2, Hard with 1.
- Each question has exactly 3 candidates: 1 correct and 2 canonical Quiz wrong
  answers; the three are shuffled.
- Only one food/candidate is visible at a time. The only answer label at the
  bottom exactly matches that visible food.
- Tapping anywhere in the gameplay area jumps; the character runs continuously.
- Passing a food removes it and shows the next candidate/label. Passing all
  three without eating restarts the same answer cycle until one is eaten.
- Eating a correct candidate gives immediate positive feedback, removes that
  food, does not freeze gameplay, and advances to the next question.
- Eating a wrong candidate gives immediate negative feedback, removes that
  food, loses one life, and continues immediately without a pause.
- No physical obstacle collision exists beyond the educational food-answer
  interaction.
- No lives means Game Over. Completing every question correctly while lives
  remain means Congratulations/completed.
- Difficulty changes only the available reading/reaction time for each food.
  Frozen timing values (per food item): Easy 4500 ms, Medium 3200 ms,
  Hard 2400 ms.
- A completion timer is required. Runner V1 persists a best-only personal-best
  record keyed by (user, difficulty, question_count) in `runner_personal_bests`
  via the `submit_runner_best_time` RPC (see migration
  `20260813020000_add_runner_database_foundation.sql`); a faster time replaces,
  an equal or slower time never worsens the record.
- Question counts offered: 12 / 18 / 24 (matching Match and Memory).

### Session content snapshot

A Runner session snapshots card IDs, not immutable copies of question text or
answers (unlike Quiz, which persists `quiz_questions` snapshots). A future Runner
client must load the complete question payload once when gameplay begins and
retain it for that run; it must not reload questions from the database during an
active game, because a card edited or deleted mid-run would otherwise change or
drop the content the player is answering.

## Readability and long text

Flashcard Front and Back text can be long. All future modes must preserve a
readable minimum font size and a consistent session-level typography decision;
they must not shrink individual cards indefinitely. Mobile readability has
priority over fitting unlimited text, and Runner gameplay must retain usable
physical space. Runner may use adaptive question/current-answer layout without
collapsing its canvas. Memory uses its separate preview/read area. Match uses a
fixed readable session typography with wrapping and moderate vertical scroll.

## Explicitly unresolved for later stages

- Whether Match, Memory, or Runner affects streaks, daily learning records, or
  general statistics.
- Memory pair-count breakpoints and final long-text typography algorithm.
- The additive database/domain design that exposes the canonical Quiz option
  operation as a side-effect-free, configurable read model while preserving
  existing Quiz semantics.
