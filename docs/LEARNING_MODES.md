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

## Match

- Pairs are Front ↔ Back for fast recognition practice.
- Pair count is adaptive to available viewport size; Phase 5A defines no fixed
  count, breakpoints, or layout values.
- Match is practice-only and must not affect FSRS or Mastery.

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
collapsing its canvas. Memory uses its separate preview/read area. Match adapts
pair count/layout to the viewport.

## Explicitly unresolved for later stages

- Easy/Medium/Hard timing values.
- Runner question count and session-selection UX.
- Insufficient Runner distractor behaviour when fewer than two canonical wrong
  answers exist.
- Whether Match, Memory, or Runner affects streaks, daily learning records, or
  general statistics.
- Final result/record persistence semantics.
- Adaptive Match/Memory pair-count breakpoints and final long-text typography
  algorithm.
- The additive database/domain design that exposes the canonical Quiz option
  operation as a side-effect-free, configurable read model while preserving
  existing Quiz semantics.
