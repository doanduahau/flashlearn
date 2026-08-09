# Quiz Engine

`/quiz` creates a server-owned multiple-choice session from regular sets, special collections, or all cards. Overlapping sources are deduplicated by flashcard id. A quiz needs 10 to 100 eligible cards; each question uses a front snapshot and 2–4 distinct normalized back-text choices.

The database RPC, not the browser, selects cards and records answers. `balanced` prefers never-tested cards, cards absent from the latest completed quiz, fewer appearances, older answers, then higher wrong rate. `never_tested` and `wrong_answers` use that order as their fallback. `pure_random` ignores history. The session and question snapshots preserve completed results when source cards are later edited or deleted.

Answers are submitted once through `submit_quiz_answer`; it locks the owned question/session and calculates score and completion server-side. The active route resumes after refresh, while completed sessions expose a read-only result and `/history` lists only the current user's completed sessions. Streaks and statistics consume `completed_at` later but have no UI in this feature.

## Smart Review launch

Smart Review uses the same quiz engine and route, without a source-selection
screen. Its Dashboard action refreshes the signed-in user's Mastery Snapshot and
passes only the first 10 server-selected `review` candidates into the explicit
quiz-target RPC. Those cards, potentially across several sets, are the questions;
other active library cards are distractors only. The result, answer behavior,
immutable quiz review events, and daily streak recording are unchanged.
