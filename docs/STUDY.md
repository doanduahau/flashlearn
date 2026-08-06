# Study Mode

Study mode lets a user review flashcards from a chosen scope. The MVP deliberately
does **not** persist study history: there is no scoring, no streak update and no
learning-statistics write during a study session. Refreshes are therefore fully
predictable because the entire session is derived from the URL query state.

## Routes

| Route            | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `/study`         | Choose the study scope and see the deduplicated card count. |
| `/study/session` | Run the flashcard study session.                            |

## Source selection (`/study`)

- The page is a Server Component. It lists the user's regular sets and special
  collections with their card counts plus the exact total number of flashcards.
- Two scope modes:
  - **Tất cả thẻ** (all cards): starts immediately at `/study/session?all=1`.
  - **Chọn bộ** (custom): any combination of regular sets and special collections.
    Selecting sources switches to custom mode. The unique card count is fetched
    per selection (debounced 250 ms) through the `getStudyCardCount` server action.
- The count is the number of **unique** flashcards after merging the chosen sources
  (see below). When no sources are selected the count is `0` and the start button is
  disabled. The start button is also disabled while a count is pending or after an
  action failure.
- When starting a custom session, the server re-checks the count one more time; if it
  dropped to zero the user gets a clear error instead of an empty session.
- If the user has no sets and no collections, `/study` shows an empty state that links
  to `/import`.

## Deduplication

- Cards are merged from all selected sources and deduplicated by `flashcard_id`
  (first occurrence wins). This is done **server-side** for both the count and the
  actual session, so a card appearing in two sets or in a set plus a collection is
  only ever studied once.
- The selected-source set can contain at most `STUDY_MAX_SOURCES` (50) items.

## Session route (`/study/session`)

The session is a query-parameter route rather than a persisted session:

- `all=1` — study every flashcard the user owns.
- `sets=<uuid>,<uuid>` — study only the given regular sets.
- `collections=<uuid>,<uuid>` — study only the given special collections.
- `seed=<0..4294967295>` — optional; when present the cards are shuffled with this
  deterministic seed.

`all` takes precedence over `sets`/`collections`. An empty combination (no `all`, no
sources) is invalid and redirects back to `/study`. Invalid UUIDs or an out-of-range
seed are also rejected.

Because the route is fully derived from query state, reloading or reopening the tab
re-derives the same cards in the same order — the current position is preserved.

### Deterministic ordering

Without a `seed`, cards are ordered by `set_id`, then `position`, then `id`. This is
stable across requests, so two reloads always show the same sequence.

### Shuffle

- The on-page shuffle toggle adds a random `seed` parameter with `router.replace`
  (no scroll). The server then applies a seeded shuffle, so the same URL always
  yields the same order.
- Toggling shuffle off removes the `seed` parameter and returns to the deterministic
  order.
- Shuffling keeps the current index, so the visible card does not jump.

### Card cap

A session is capped at `STUDY_MAX_CARDS` (1,000) cards. When the merged source
exceeds the cap, the first 1,000 cards are kept and a visible notice explains that
the session is truncated.

## Session UI

- **Front first**: the front of the current card is shown; flip to reveal the back.
- **Progress bar** with `1 / N` readout and proper `aria` attributes
  (`aria-valuemin="1"`, `aria-valuemax={N}`, `aria-valuenow={index + 1}`).
- **Navigation**: previous / next buttons; "Hoàn thành" replaces the next button on
  the last card and returns to `/study`. The previous button is disabled on the first
  card. Flipping resets on navigation.
- **Keyboard** (when no form control is focused): `Space`/`Enter` flip the card,
  `ArrowRight` next, `ArrowLeft` previous.
- **Original set name** is shown with each card.
- **Special-collection membership** control is available per card during the session.
  It reuses the same `updateCardCollections` server action and `set_card_collections`
  RPC as `/sets/[setId]`, so the hardened write boundary is shared. Edits appear in
  every collection immediately because collections only store links to the original
  flashcard.
- **Reduced motion**: the flip animation is disabled for users who prefer reduced
  motion.

## Out of scope for this feature

- Quiz scoring, attempt history, streaks, spaced-repetition scheduling, editing card
  content mid-session, and audio. None of these are persisted by study mode.
