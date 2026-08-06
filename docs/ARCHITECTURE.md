# Architecture

## CSV/XLSX import

The import feature parses selected files entirely in browser memory, presents a client-side guided mapping and preview, then sends only normalized text rows to a server action. The action validates its Zod payload and calls a single authenticated database RPC; no source file or `user_id` is persisted or accepted.

## Set and card management

Regular sets are created only through import. `/sets` lists them with card counts and
client-side name search. `/sets/[setId]` supports rename, delete-set, add/edit/delete
cards, card search and pagination.

- **Server actions** (`src/features/flashcard-sets/server/actions.ts`) validate every
  payload with shared Zod schemas, derive identity from the session via
  `supabase.auth.getClaims()`, and never trust a client-supplied `user_id`.
- **Positioning** is database-bound. `public.add_flashcard` locks the parent set row
  and computes `max(position) + 1`, so concurrent or repeated additions cannot
  collide; the browser never sends a position.
- **Ownership isolation** comes from RLS. Updates/deletes that match another user's
  rows affect zero rows and surface as a generic not-found, so users cannot learn
  whether a set or card exists.
- **Cascade deletion** is enforced by foreign keys: deleting a set removes its cards
  and their special-collection memberships.
- Rename, delete-set, edit-card and delete-card use direct RLS-filtered table
  operations; only card insertion needs an RPC for atomic positioning. Card
  reordering and manual empty-set creation are deferred.

## Special collections

Special collections let a user group flashcards across regular sets without copying card
content. `/collections` lists collections with card counts and a create form;
`/collections/[collectionId]` supports rename, delete and remove-membership; each card on
`/sets/[setId]` has a compact membership control.

- **Server actions** (`src/features/special-collections/server/actions.ts`) validate
  shared Zod payloads and derive identity from the session; the client never supplies
  `user_id`.
- **Write boundary is the database.** Direct INSERT on `special_collections` and
  `special_collection_items` is revoked. `create_special_collection` and
  `set_card_collections` are narrow `SECURITY DEFINER` RPCs that derive the owner from
  `auth.uid()` and validate inputs. Rename, delete and remove-membership remain direct
  RLS-filtered table operations with column-limited grants.
- **Idempotent membership sync.** `set_card_collections(card_id, collection_ids)` deletes
  memberships not in the list and inserts the listed ones with
  `on conflict (collection_id, flashcard_id) do nothing`, so repeated submissions never
  duplicate a card in a collection.
- **Duplicate names** are enforced by the existing `(user_id, lower(name))` unique index;
  the server action maps the `23505` violation to a friendly Vietnamese message.
- **Non-disclosing errors.** A missing or foreign card, collection or membership all
  surface as the same generic message. Invalid collection ids are rejected before the
  membership sync mutates any rows.

## Study mode

Study mode lets a user review flashcards from a chosen scope without leaving any trace,
so refreshes are predictable and the session is derived entirely from query state.

- **Source selection** (`/study`) lists regular sets and special collections with card
  counts and the exact total of the user's flashcards. `/study` is a Server Component
  that counts each source with `.select(..., { count: "exact", head: true })` and passes
  the data to `StudySourceSelect`, which keeps selection in client state and fetches a
  debounced unique-card count per selection via `getStudyCardCount`.
- **Deterministic session route.** `/study/session` is a query-parameter route
  (`?all=1`, `?sets=…&collections=…`, optional `seed=…`) instead of a persisted session.
  On every request the server re-derives the same card set and order, so a refresh or a
  reopened tab returns the same position. Deterministic order is `set_id`, then
  `position`, then `id`; an on-page shuffle toggle only adds/removes a `seed` query
  parameter (`router.replace`), preserving the current index.
- **Data loading is server-boundary.** `loadStudySession` parses the query params with a
  strict Zod schema (max 50 sources, valid UUIDs, 32-bit seed), derives identity from
  `supabase.auth.getClaims()`, fetches set/collection rows under RLS only, deduplicates by
  flashcard id (first occurrence wins), sorts deterministically and caps the session at
  `STUDY_MAX_CARDS` (1,000) with a visible truncation notice. No service-role key, no
  per-card queries.
- **Membership in session.** The per-card collection control reuses the same
  `updateCardCollections` server action and `set_card_collections` RPC as
  `/sets/[setId]`, so the hardened write boundary is shared rather than duplicated.
- **No study history.** The MVP does not persist study sessions, so there is nothing to
  leak or reset; scoring, streaks and statistics remain quiz-scoped. See `docs/STUDY.md`
  for the full session behavior (flip, navigation, keyboard, shuffle).

## Profile settings

`/profile?tab=settings` lets a user view their read-only email and edit their display name and IANA
timezone. The feature lives under `src/features/profile/` and follows the same hardened
boundaries as the other features:

- **Read-only page data.** `profile/page.tsx` is a Server Component that loads
  `{ email, display_name, timezone, timezone_changed_at }` through `loadProfileSettings`; the email comes from
  `supabase.auth.getUser()` and the profile fields from the user's own RLS row. Identity is
  always derived from the session, never from the client.
- **Write boundary is an RPC.** `update_profile` (a `SECURITY DEFINER` function with an
  empty `search_path`) is the only way to change profile fields. Direct `UPDATE` on
  `profiles` is revoked, so neither the client nor a forged request can rewrite `id`,
  `avatar_url` or timestamps. The RPC validates the timezone against
  `pg_timezone_names` at the database boundary and trims/validates the display name.
- **Client + server validation.** `updateProfileSchema` trims the display name (blank →
  null, max 100) and checks the timezone against a curated list derived from the IANA
  database, so the server action re-validates whatever the form submits.
- **Timezone cooldown and immutable activity.** A successful timezone change records a
  server-controlled `timezone_changed_at`; PostgreSQL refuses another changed timezone for 72
  hours and returns the next permitted timestamp. Display-name-only changes remain allowed. On
  quiz completion, the answer RPC snapshots the current timezone and local date into one
  `daily_learning_records` row. Statistics use those immutable rows, so a later timezone change
  affects only future completed activity—not prior streak dates. `/profile` and `/dashboard` are
  revalidated after a successful save, and the app-shell `CurrentUser` refetches the display name
  on navigation.
- **Local-time preview.** `LocalTimePreview` shows the current time in the selected
  timezone (refreshed every minute), so the user can verify the choice before saving.
- **Not implemented (deferred).** Email change, password change/recovery, avatar upload,
  account deletion and notification settings are outside the current scope.

## Scope

This document describes the architecture decisions that underpin the FlashLearn
application. The application is a Next.js App Router app backed by Supabase; see
`AGENTS.md` for the full product blueprint and `docs/DATABASE.md` for the schema details.

The foundation covers data ownership (profiles, flashcard sets, flashcards,
special collections and their membership table), authentication (email/password
sign-up, sign-in, email confirmation, sign-out, route protection), imports,
regular set/card management (rename, delete, add/edit/delete cards), special
collection management (create, rename, delete, membership sync) and flashcard
study mode. Quiz, streak and analytics are implemented in later phases.

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

## Authentication architecture

Authentication uses Supabase Auth with email/password, managed through cookie-based
sessions via `@supabase/ssr`. See `docs/AUTH.md` for the full auth documentation.

### Key components

- **`src/lib/supabase/client.ts`:** Browser client for Client Components only.
- **`src/lib/supabase/server.ts`:** Server client for server-side data fetching and
  server actions. Never imported into Client Components.
- **`src/lib/supabase/proxy.ts`:** Proxy middleware that refreshes the session on every
  request by calling `getClaims()`.
- **`src/proxy.ts`:** Next.js 16 request interception entry point that refreshes sessions and enforces route protection.
- **`src/features/auth/`:** Feature-first auth code (schemas, server actions, components,
  utils, types).

### Auth checks

- `supabase.auth.getClaims()` is used for authentication checks in proxy and layout.
- `supabase.auth.getUser()` is used only where the latest full Auth user record is
  needed (e.g., the `CurrentUser` component displaying the user's email).
- `getSession()` is not used as proof of identity.

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
  low-privilege `authenticated` role so RLS is actually exercised. `008` covers set
  rename/delete, card add/edit/delete, next-position assignment, cross-user
  isolation and anonymous denial. `009` covers collection create/rename/delete and
  idempotent membership sync against the hardened grants.
- Unit tests for auth schemas, safe redirect, and error mapping are in
  `tests/unit/features/auth/`.
- Unit tests for set/card schemas, search sanitization and mutation error mapping are
  in `tests/unit/features/flashcard-sets/`.
- Unit tests for collection schemas and special-collection components (create, rename,
  delete, remove-membership, per-card membership control) are in
  `tests/unit/features/special-collections/`.
- Component tests for set/card management forms (rename, add/edit/delete card, delete
  set, confirmation, pending and error states) are in
  `tests/unit/features/flashcard-sets/`.
- Component tests for sign-in and sign-up forms are in `tests/unit/features/auth/`.
- E2E tests for the complete auth flow are in `tests/e2e/auth.spec.ts`.
- E2E tests for set/card management with isolated users (including import, rename,
  add/edit/delete, cross-user 404 isolation) are in `tests/e2e/set-management.spec.ts`.
- E2E tests for special collections (create, duplicate-name rejection, membership add
  and idempotency, per-collection remove, rename, delete, cross-user 404 isolation) are
  in `tests/e2e/special-collections.spec.ts`.
- Unit tests for study schemas, source merging/deduplication and seeded shuffle are in
  `tests/unit/features/study/`.
- Component tests for the source selector (debounced unique count, errors, empty state)
  and the study session (flip, navigation, keyboard, shuffle, membership) are in
  `tests/unit/features/study/`.
- E2E tests for study mode (deduplicated count, deterministic refresh, shuffle across
  reload, in-session membership, cross-user source isolation) are in
  `tests/e2e/study-mode.spec.ts`.
- Quiz sessions use server-rendered routes and small client interaction components. The
  browser receives choices but not a correct-choice index before answer submission; the
  database RPC owns card selection, snapshots, answer state and scoring.
- Statistics are server-rendered from a zero-argument, read-only RPC. It derives streaks
  and aggregate values from completed owned sessions and never persists duplicated analytics.

## Future phases

- Learning statistics and daily streak presentation will build from completed quiz
  timestamps and question snapshots without changing historical results.
- Import parsing stays client-side for preview, but the persisted payload is re-validated
  server-side before insert, and a transaction guarantees set + flashcards are written
  atomically.
