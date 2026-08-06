# Database

## Overview

FlashLearn uses Supabase (PostgreSQL 15) as its database. This document describes the
foundation schema, its constraints, indexes, triggers and row-level security policies.

The core foundation intentionally covers only data ownership: `profiles`,
`flashcard_sets`, `flashcards`, `special_collections` and `special_collection_items`.
Quiz attempts, learning statistics and streak tables are added in later phases.

## ERD

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : "id = id"
    AUTH_USERS ||--o{ FLASHCARD_SETS : "owns"
    AUTH_USERS ||--o{ FLASHCARDS : "owns"
    AUTH_USERS ||--o{ SPECIAL_COLLECTIONS : "owns"
    AUTH_USERS ||--o{ SPECIAL_COLLECTION_ITEMS : "owns"
    FLASHCARD_SETS ||--o{ FLASHCARDS : "(user_id, id) = (user_id, set_id)"
    FLASHCARDS ||--o{ SPECIAL_COLLECTION_ITEMS : "(user_id, id) = (user_id, flashcard_id)"
    SPECIAL_COLLECTIONS ||--o{ SPECIAL_COLLECTION_ITEMS : "(user_id, id) = (user_id, collection_id)"
```

## Schemas

| Table                      | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `profiles`                 | Per-user profile, one row per Auth user        |
| `flashcard_sets`           | Regular flashcard sets (one per import)        |
| `flashcards`               | Flashcard rows owned by a user within a set    |
| `special_collections`      | User-created collections that group flashcards |
| `special_collection_items` | Membership link between a collection and card  |

## Tables

### `public.profiles`

| Column         | Type          | Default              | Notes                                       |
| -------------- | ------------- | -------------------- | ------------------------------------------- |
| `id`           | `uuid`        | —                    | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `display_name` | `text`        | —                    | NULL if blank; max 100 chars                |
| `avatar_url`   | `text`        | —                    | max 500 chars                               |
| `timezone`     | `text`        | `'Asia/Ho_Chi_Minh'` | max 64 chars                                |
| `created_at`   | `timestamptz` | `now()`              |                                             |
| `updated_at`   | `timestamptz` | `now()`              | refreshed by trigger                        |

Rows are created only by the `handle_new_user` trigger (one per Auth user). There is no
public INSERT policy, so users cannot create a profile for another Auth user.

### `public.flashcard_sets`

| Column            | Type          | Default             | Notes                                   |
| ----------------- | ------------- | ------------------- | --------------------------------------- |
| `id`              | `uuid`        | `gen_random_uuid()` | PK                                      |
| `user_id`         | `uuid`        | —                   | FK → `auth.users(id)` ON DELETE CASCADE |
| `name`            | `text`        | —                   | non-blank; max 120 chars                |
| `description`     | `text`        | —                   | max 500 chars                           |
| `source_filename` | `text`        | —                   | max 255 chars                           |
| `created_at`      | `timestamptz` | `now()`             |                                         |
| `updated_at`      | `timestamptz` | `now()`             | refreshed by trigger                    |

Duplicate set names are allowed in the MVP: the same name may be reused across users,
and even by one user when a new import is created. See
`docs/DECISIONS/001-core-data-ownership.md`.

### `public.flashcards`

| Column       | Type          | Default             | Notes                                   |
| ------------ | ------------- | ------------------- | --------------------------------------- |
| `id`         | `uuid`        | `gen_random_uuid()` | PK                                      |
| `user_id`    | `uuid`        | —                   | FK → `auth.users(id)` ON DELETE CASCADE |
| `set_id`     | `uuid`        | —                   | See ownership FK below                  |
| `front`      | `text`        | —                   | non-blank; max 50000 chars              |
| `back`       | `text`        | —                   | non-blank; max 50000 chars              |
| `position`   | `integer`     | `0`                 | `>= 0`                                  |
| `created_at` | `timestamptz` | `now()`             |                                         |
| `updated_at` | `timestamptz` | `now()`             | refreshed by trigger                    |

Ownership FK: `(user_id, set_id)` → `flashcard_sets(user_id, id)` ON DELETE CASCADE.
This guarantees a flashcard's owner and its set's owner are always the same user,
at the database level.

### `public.special_collections`

| Column       | Type          | Default             | Notes                                   |
| ------------ | ------------- | ------------------- | --------------------------------------- |
| `id`         | `uuid`        | `gen_random_uuid()` | PK                                      |
| `user_id`    | `uuid`        | —                   | FK → `auth.users(id)` ON DELETE CASCADE |
| `name`       | `text`        | —                   | non-blank; max 60 chars                 |
| `icon`       | `text`        | —                   | max 32 chars                            |
| `color`      | `text`        | —                   | max 32 chars                            |
| `created_at` | `timestamptz` | `now()`             |                                         |
| `updated_at` | `timestamptz` | `now()`             | refreshed by trigger                    |

Collection names are unique per user with a case-insensitive comparison
(`unique index (user_id, lower(name))`).

### `public.special_collection_items`

| Column          | Type          | Notes                                   |
| --------------- | ------------- | --------------------------------------- |
| `user_id`       | `uuid`        | FK → `auth.users(id)` ON DELETE CASCADE |
| `collection_id` | `uuid`        | part of PK, composite FK                |
| `flashcard_id`  | `uuid`        | part of PK, composite FK                |
| `created_at`    | `timestamptz` | default `now()`                         |

- PK: `(collection_id, flashcard_id)` — a card belongs to a collection at most once.
- Composite FKs enforce that both the collection and the flashcard belong to the same
  user as the membership:
  - `(user_id, collection_id)` → `special_collections(user_id, id)`
  - `(user_id, flashcard_id)` → `flashcards(user_id, id)`
- Both FKs are ON DELETE CASCADE, so deleting a collection or a flashcard removes the
  membership automatically. No UPDATE policy exists: the table has no meaningful
  updatable fields.

## Triggers

| Trigger                | Table        | When          | Function                   |
| ---------------------- | ------------ | ------------- | -------------------------- |
| `set_updated_at`       | all 4 core   | BEFORE UPDATE | `public.set_updated_at()`  |
| `on_auth_user_created` | `auth.users` | AFTER INSERT  | `public.handle_new_user()` |

- `set_updated_at()` refreshes `updated_at = now()` on every row update.
- `handle_new_user()` creates one profile per new Auth user. It is `SECURITY DEFINER`
  with an empty `search_path`. Only the `display_name` field is copied from the raw user
  metadata, validated and trimmed; unknown metadata is ignored.

## Row Level Security

All five core tables have RLS enabled. Policies follow a strict ownership model based on
`auth.uid()` (the `sub` claim of the authenticated JWT). Anonymous users are denied
entirely (no `anon` grants).

| Table                      | Policies (all `to authenticated`)    |
| -------------------------- | ------------------------------------ |
| `profiles`                 | SELECT own, UPDATE own               |
| `flashcard_sets`           | SELECT/INSERT/UPDATE/DELETE own      |
| `flashcards`               | SELECT/INSERT/UPDATE/DELETE own      |
| `special_collections`      | SELECT/INSERT/UPDATE/DELETE own      |
| `special_collection_items` | SELECT/INSERT/DELETE own (no UPDATE) |

Flashcard INSERT/UPDATE policies additionally require the referenced set to belong to
the current user. Membership INSERT/SELECT/DELETE policies require both the referenced
collection and flashcard to belong to the current user. Note that the INSERT policies on
`special_collections` and `special_collection_items` are effectively dormant: the
corresponding table grants were revoked in the special-collections hardening migration and
writes now go through scoped RPCs (see below).

## Grants

- `anon`: no privileges on core tables.
- `authenticated`: `profiles` (SELECT, UPDATE); `flashcard_sets`/`flashcards`
  (SELECT, DELETE + column-limited UPDATE); `special_collections`
  (SELECT, DELETE + `UPDATE (name, icon, color)`); `special_collection_items`
  (SELECT, DELETE).
- Direct INSERT and unrestricted UPDATE are revoked for `flashcard_sets`, `flashcards`,
  `special_collections` and `special_collection_items`. Rows are created only through
  scoped RPCs that derive ownership from `auth.uid()`.
- `service_role`: ALL on all core tables (server-side only; never exposed to the browser).
- Default privileges grant `SELECT, INSERT, UPDATE, DELETE` on future tables (and
  `USAGE, SELECT` on sequences) to `authenticated`, so later phases do not need repeated
  grants.

## Indexes

| Index                                    | Table                      | Purpose                       |
| ---------------------------------------- | -------------------------- | ----------------------------- |
| `idx_flashcard_sets_user_created`        | `flashcard_sets`           | list sets by recency per user |
| `idx_flashcards_set_position`            | `flashcards`               | order cards within a set      |
| `idx_flashcards_user`                    | `flashcards`               | cards by user                 |
| `idx_special_collections_user`           | `special_collections`      | collections by user           |
| `idx_special_collection_items_flashcard` | `special_collection_items` | memberships by flashcard      |
| `idx_special_collections_user_name`      | `special_collections`      | unique name per user (lower)  |

## Commands

Requires Docker and the local Supabase stack. Use the npm scripts:

```bash
npm run supabase:start    # start the local Supabase stack
npm run supabase:stop     # stop the local Supabase stack
npm run supabase:status   # show stack status and API keys
npm run db:reset          # apply migrations + seed from a clean database
npm run db:test           # run pgTAP database tests (supabase/tests/*.sql)
npm run db:types          # regenerate src/lib/supabase/types.ts
```

Studio UI: <http://localhost:54323>. Local Postgres: `localhost:54322` (postgres/postgres).

## Database tests

pgTAP tests live in `supabase/tests/` and run inside a transaction against the reset
database. They verify constraints, profile/trigger behavior, per-user ownership via the
`authenticated` role, cascade behavior and database-level integrity:

| File                                      | Coverage                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `001_constraints.sql`                     | NOT NULL / CHECK / unique / FK constraints                                              |
| `002_profiles.sql`                        | profile trigger + ownership                                                             |
| `003_flashcard_sets_ownership.sql`        | set and flashcard ownership (A vs B)                                                    |
| `004_special_collections_ownership.sql`   | collection + membership ownership                                                       |
| `005_cascades.sql`                        | delete cascades (card, collection, set, user)                                           |
| `006_triggers.sql`                        | updated_at refresh on all tables                                                        |
| `007_import_flashcard_set.sql`            | atomic import RPC (counts, owner, validation)                                           |
| `008_set_card_mutations.sql`              | rename/delete set, add/edit/delete card, next position, isolation, anon denial          |
| `009_special_collections_memberships.sql` | create/rename/delete collection, idempotent membership sync, duplicate names, isolation |

Tests run malicious operations as a low-privilege `authenticated` role (via
`set local role authenticated; set local request.jwt.claim.sub = '<uuid>'`), never only
as `postgres`, so they exercise RLS rather than bypassing it.

## Atomic file import

`public.import_flashcard_set(text, jsonb)` derives ownership from `auth.uid()` and atomically creates one regular set and ordered cards. It validates 1–2,000 normalized cards before writing. Errors roll back all writes. The security-definer function uses an empty `search_path` and grants EXECUTE only to `authenticated`.

## Set and card management

Regular sets are created exclusively through import (see `docs/IMPORT.md`). Manual
empty-set creation is deferred. The following mutations are supported:

| Operation   | Mechanism                                | Notes                                               |
| ----------- | ---------------------------------------- | --------------------------------------------------- |
| Rename set  | `UPDATE flashcard_sets` via RLS          | Name trimmed by the shared Zod schema               |
| Delete set  | `DELETE flashcard_sets` via RLS          | Cascades to its flashcards and their memberships    |
| Add card    | `public.add_flashcard(uuid, text, text)` | Positions assigned at the database boundary         |
| Edit card   | `UPDATE flashcards` via RLS              | Front/back only; position never changes             |
| Delete card | `DELETE flashcards` via RLS              | Position gaps are acceptable; relative order stable |

### Position behavior

- Every card carries a `position` starting at `0` within its set.
- New cards are appended with `max(position) + 1`, computed by the `add_flashcard`
  RPC which locks the parent set row (`SELECT ... FOR UPDATE`) so concurrent or
  repeated submissions serialize and never observe a stale maximum.
- The client never supplies `user_id`, set ownership, or position.
- Deleting a card leaves the remaining positions unchanged, so gaps may appear;
  reordering is deferred to a later phase.

### Ownership and security

- All mutations run under RLS keyed to `auth.uid()`; identity always comes from the
  Supabase session, never from the browser.
- Rename/delete/edit operations that touch another user's rows are filtered by RLS
  and return zero affected rows, which the server action maps to a generic
  not-found message (no data disclosure).
- `add_flashcard` verifies the target set belongs to the caller and raises the same
  error for a missing set and a foreign set.
- `anon` is denied table privileges and the `add_flashcard` EXECUTE grant.
- Card content is never logged.

### Deferred work

Card reordering and manual empty-set creation are intentionally out of scope for the
current phase; the schema already supports both without migration.

## Special collections

Collections group flashcards from one or more regular sets. A flashcard can belong to
many collections; `special_collection_items` stores only the link, never a copy of card
content. Edits to the original flashcard are visible everywhere it is collected.

| Operation                   | Mechanism                                            | Notes                                                                                |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Create collection           | `public.create_special_collection(text, text, text)` | Derives owner from `auth.uid()`; trims name; duplicate names rejected (unique index) |
| Rename collection           | `UPDATE special_collections` via RLS                 | `name`/`icon`/`color` only; name trimmed by Zod                                      |
| Delete collection           | `DELETE special_collections` via RLS                 | Cascades to its memberships only                                                     |
| Add/remove card memberships | `public.set_card_collections(uuid, uuid[])`          | Idempotent sync; removes unlisted, adds listed on conflict-do-nothing                |
| Remove one membership       | `DELETE special_collection_items` via RLS            | Only own collection + card memberships                                               |

Both RPCs are `SECURITY DEFINER` with an empty `search_path` and EXECUTE granted only to
`authenticated`. They derive `user_id` from `auth.uid()` and validate inputs:

- `create_special_collection` rejects blank names, names over 60 chars, and icons/colors
  over 32 chars (`22023`), and lets the `(user_id, lower(name))` unique index surface
  duplicates as `23505`.
- `set_card_collections` requires the card to belong to the caller (a missing and a
  foreign card raise the same `22023`), silently ignores collection ids the caller does
  not own, and is idempotent: repeating the same sync never duplicates memberships.
- Rename/delete/remove operations touch another user's rows under RLS and return zero
  affected rows, which the server action maps to a generic not-found message.

### Duplicate collection names

Collection names are unique per user with a case-insensitive comparison
(`idx_special_collections_user_name`). The client never pre-checks; it relies on the
database rule and maps the `23505` unique violation to a friendly "Tên đã tồn tại."
message shared with regular set naming.

## Generated types

`npm run db:types` generates `src/lib/supabase/types.ts` from the live local database.
Types are checked in and must be regenerated whenever the schema changes.
