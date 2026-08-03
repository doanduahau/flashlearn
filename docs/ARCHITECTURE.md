# Architecture

## Scope

This document describes the architecture decisions that underpin the FlashLearn database
foundation. The application is a Next.js App Router app backed by Supabase; see
`AGENTS.md` for the full product blueprint and `docs/DATABASE.md` for the schema details.

The current foundation covers only data ownership (profiles, flashcard sets, flashcards,
special collections and their membership table). Authentication UI, imports, study mode,
quiz, streak and analytics are implemented in later phases.

## Principles applied

1. **Server-first.** The database is the source of truth for data access. Business rules
   that protect data integrity live in the database (constraints, triggers, RLS), not in
   the client.
2. **Security by policy, not trust.** Every table that holds user data is protected by
   row-level security keyed to `auth.uid()`. The server never trusts a `user_id` sent by
   the client; it derives the user from the session.
3. **Ownership integrity at the database level.** Where a row references another owned
   entity, composite foreign keys enforce that the owner matches, so cross-user links are
   impossible even if RLS were bypassed.
4. **No over-engineering.** The MVP keeps the schema small and each table owned by a
   single user. Quiz, streak and analytics tables are intentionally deferred until their
   data shapes are known.

## Data ownership model

```
auth.users (Supabase Auth)
   ├─ profiles                  (1:1, via handle_new_user trigger)
   ├─ flashcard_sets            (1:N)
   │     └─ flashcards          (1:N, owned by set owner via composite FK)
   ├─ special_collections       (1:N)
   └─ special_collection_items  (M:N between collections and flashcards)
        (composite FKs keep owner consistent)
```

Key consequences:

- A flashcard can never belong to a set owned by another user.
- A special collection membership can never link a collection and a flashcard owned by
  different users.
- Deleting a user (or a set, collection or flashcard) cascades to dependent rows, so the
  database never leaves orphaned data.

## Row Level Security strategy

- `anon` has no access to core tables.
- `authenticated` sees and mutates only its own rows through ownership policies.
- `profiles` has no INSERT policy; the `handle_new_user` trigger is the only way a
  profile is created.
- Flashcard and membership policies re-check the referenced entities, closing the risk of
  manipulating another user's data through a foreign key value.
- `service_role` keeps admin access for trusted server code only.

## Database triggers

- `handle_new_user`: creates a profile on Auth signup; `SECURITY DEFINER` with empty
  `search_path`; copies only a validated `display_name` from raw metadata.
- `set_updated_at`: refreshes `updated_at` on every update of a core table.

Both are deliberately small and defensive (empty `search_path`, explicit `nullif`/
`btrim`) so they are safe to run with elevated privileges.

## Local development workflow

Docker Desktop must be running. Commands are wrapped in npm scripts (see
`docs/DATABASE.md` → Commands):

1. `npm run supabase:start` — boots Postgres, Auth, Storage and Studio locally.
2. `npm run db:reset` — rebuilds the local database from migrations + seed.
3. Create a user in Studio → Authentication, or sign up from the app; the trigger
   creates the matching profile.
4. `npm run db:test` — runs pgTAP tests against the reset database.
5. `npm run db:types` — regenerates `src/lib/supabase/types.ts`.

Migrations are the only supported way to change the schema. Applied migrations are never
edited; a new migration is added instead. Destructive migrations must be documented with
a rollback path.

## Testing strategy

- Database behavior is verified with pgTAP in `supabase/tests/`, running as a
  low-privilege `authenticated` role so RLS is actually exercised.
- Unit/integration/component/E2E tests for application code are added in later phases.

## Future phases

- Quiz attempts, attempt items, learning stats and daily learning records will reuse the
  same ownership pattern (composite FKs + RLS keyed to `auth.uid()`).
- Import parsing stays client-side for preview, but the persisted payload is re-validated
  server-side before insert, and a transaction guarantees set + flashcards are written
  atomically.
