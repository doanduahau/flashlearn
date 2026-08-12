# Phase 5 — Learning modes foundation

Phase 5 adds practice and play modes around the existing flashcard domain. This
document freezes the product rules and records the current Quiz boundary that
future implementation stages must reuse. Phase 5A adds no route, UI, game loop,
database table, migration, or persistence.

## Mode map

| Group    | Mode             | Purpose                       | Learning-data effect in Phase 5               |
| -------- | ---------------- | ----------------------------- | --------------------------------------------- |
| Learning | Traditional Quiz | Graded recall                 | Existing Quiz behavior remains unchanged.     |
| Learning | Match            | Fast Front → Back recognition | Practice only; no Quiz/session/grading write. |
| Play     | Memory Matching  | Find Front ↔ Back pairs       | Practice only; no Quiz/session/grading write. |
| Play     | Flashcard Runner | Educational runner game       | Practice only; no Quiz/session/grading write. |

Match, Memory Matching, and Flashcard Runner must not update FSRS schedules,
Mastery, `card_review_events`, `quiz_sessions`, `daily_learning_records`,
streaks, or statistics in Phase 5. Whether practice/game activity later affects
streaks or general statistics remains a product decision for a later phase.

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

Flashcard Runner must use this exact canonical operation rather than a second
distractor algorithm. It needs exactly three candidates: one correct and two
wrong. The current public application/domain layer has no read-only,
configurable option-builder: option generation is coupled to transactional Quiz
snapshot insertion in SQL. Generalizing it would require a future additive
database design, which is deliberately out of scope for Phase 5A.

The current Quiz rule also permits a target with only one unique wrong answer,
which yields two total choices. Consequently, Runner cannot guarantee its three
unique candidates for every eligible card today. A later Runner stage must get
an explicit product decision for the insufficient-two-distractor case before
shipping; it must not invent placeholder or duplicated answers.

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

Match is client/read-only practice after card data is loaded. It performs no
DB writes: no `quiz_sessions`, no quiz answers, no `card_review_events`, no FSRS
scheduling, no mastery updates, no `daily_learning_records`, no streak or
statistics changes, and no game-result persistence.

### Accessibility

- Semantic interactive controls with visible keyboard focus.
- Selected state exposed via `aria-pressed`.
- Matched/disabled cards are non-interactive (`disabled`) and communicate state
  with opacity plus semantic disabled state, not color alone.
- Error feedback is text-based and respects `prefers-reduced-motion`.
- Clear section/title structure for screen readers.

## Memory Matching

- Pairs are Front ↔ Back.
- The compact grid occupies the main interaction area.
- A separate preview/read area above the grid shows the full currently flipped
  card content. Grid cards must not render long Flashcard text at unreadably
  small sizes.
- Pair count/grid shape is adaptive to available viewport size; Phase 5A defines
  no final breakpoints or dimensions.
- Memory Matching is practice-only and must not affect FSRS or Mastery.

## Flashcard Runner

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
- Difficulty changes only the available reading/reaction time for each food;
  concrete timing values are intentionally not yet defined.
- A completion timer is required. A future record, if product-approved, must
  include question count, difficulty, and completion time; Phase 5A creates no
  such persistence.

## Readability and long text

Flashcard Front and Back text can be long. All future modes must preserve a
readable minimum font size and a consistent session-level typography decision;
they must not shrink individual cards indefinitely. Mobile readability has
priority over fitting unlimited text, and Runner gameplay must retain usable
physical space. Runner may use adaptive question/current-answer layout without
collapsing its canvas. Memory uses its separate preview/read area. Match uses a
fixed readable session typography with wrapping and moderate vertical scroll.

## Explicitly unresolved for later stages

- Easy/Medium/Hard timing values.
- Runner question count and session-selection UX.
- Insufficient Runner distractor behaviour when fewer than two canonical wrong
  answers exist.
- Whether Match, Memory, or Runner affects streaks, daily learning records, or
  general statistics.
- Final result/record persistence semantics.
- Memory pair-count breakpoints and final long-text typography algorithm.
- The additive database/domain design that exposes the canonical Quiz option
  operation as a side-effect-free, configurable read model while preserving
  existing Quiz semantics.
