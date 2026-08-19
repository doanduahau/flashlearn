# ADR 001 — Core data ownership model

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

CapyStudy lets users create flashcard sets (from Excel/CSV imports), collect individual
flashcards into special collections, and later run quizzes over a chosen scope. All of
that data belongs to a single user and must never leak across users.

The foundation needed a data model that:

1. ties every piece of user data to an Auth user,
2. prevents a flashcard from living in a set owned by another user,
3. lets a flashcard appear in many special collections without copying its content,
4. guarantees a special collection only ever references a user's own flashcards,
5. keeps row-level security as the primary access boundary while keeping a
   database-level backstop for the ownership invariants.

## Considered options

### Option A — RLS only, plain foreign keys

Each table has a `user_id` and simple FKs (`flashcards.set_id → flashcard_sets.id`,
`special_collection_items.flashcard_id → flashcards.id`). Isolation relies on RLS
`USING (user_id = auth.uid())`.

- Pro: minimal schema.
- Con: the database itself does not prevent cross-user references. If a bug or a
  `service_role` path ever writes a flashcard whose `set_id` points to another user's
  set, the data becomes inconsistent and RLS would silently hide it. There is no
  integrity backstop.

### Option B — Composite ownership foreign keys (chosen)

Store `user_id` on `flashcards` and `special_collection_items` and reference
`(user_id, id)` of the parent tables:

- `flashcards (user_id, set_id)` → `flashcard_sets (user_id, id)`
- `special_collection_items (user_id, collection_id)` → `special_collections (user_id, id)`
- `special_collection_items (user_id, flashcard_id)` → `flashcards (user_id, id)`

The parent tables expose `UNIQUE (user_id, id)` as the FK target. RLS still enforces
visibility and mutation per user; the composite FKs enforce ownership consistency at the
database level, independent of the role executing the statement.

- Pro: cross-user references are impossible even when RLS is bypassed.
- Pro: cascades stay consistent — deleting a set deletes its flashcards and their
  memberships; deleting a user deletes everything.
- Con: `user_id` is denormalized on two tables. It is kept immutable by RLS policies
  (no UPDATE policy on `special_collection_items`; `WITH CHECK` pins `user_id` on
  `flashcards`).

### Option C — Junction table without `user_id`

A plain `(collection_id, flashcard_id)` junction with an implicit owner lookup.

- Pro: no denormalized `user_id`.
- Con: enforces same-user membership only through two hops, which a single foreign key
  cannot express; would require a trigger to enforce ownership, which is more complex
  and easier to get wrong than a composite FK.

## Decision

Adopt Option B. Core user tables store `user_id` and use composite ownership foreign
keys, backed by `UNIQUE (user_id, id)` targets. All five core tables have RLS enabled
and ownership policies. `profiles` is created only through the `handle_new_user`
trigger (no INSERT policy). `updated_at` is maintained by a `set_updated_at` trigger.

Duplicate set names are allowed in the MVP (the same name may be reused across users,
and by one user across imports). Special collection names are unique per user with a
case-insensitive comparison.

## Consequences

- RLS is the runtime access boundary; composite FKs are the integrity backstop. Both
  are covered by pgTAP tests (`supabase/tests/`) that run as a low-privilege
  `authenticated` role.
- Later tables (quiz attempts, learning stats, daily learning records) should reuse the
  same pattern: `user_id` + ownership policies, and composite FKs where a row references
  two owned entities.
- `user_id` duplication is accepted and kept immutable through RLS `WITH CHECK`.
- `gen_random_uuid()` requires the `pgcrypto` extension (created in `extensions` schema
  with `if not exists`).

## References

- `docs/DATABASE.md` — full schema, constraints, indexes, RLS and grants.
- `docs/ARCHITECTURE.md` — architecture notes and local workflow.
