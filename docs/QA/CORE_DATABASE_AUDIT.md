# Core Database Audit

## Verdict

PASS

## Tested Commit

`9b25974` — feat: add core database foundation

## Environment

| Item         | Value                   |
| ------------ | ----------------------- |
| OS           | Windows 11 (PowerShell) |
| Node         | v25.3.0                 |
| npm          | 11.6.2                  |
| Next.js      | 16.2.12 (Turbopack)     |
| Playwright   | Chromium (latest)       |
| Docker       | Docker Desktop 29.5.2   |
| Supabase CLI | local stack via npm     |

## Application Command Results

| Command                | Result  | Notes                                  |
| ---------------------- | ------- | -------------------------------------- |
| `npm run format:check` | ✅ PASS | No formatting regressions.             |
| `npm run lint`         | ✅ PASS | No linting regressions.                |
| `npm run typecheck`    | ✅ PASS | Types remain valid.                    |
| `npm run test`         | ✅ PASS | Component/unit tests unaffected.       |
| `npm run build`        | ✅ PASS | Build completes successfully.          |
| `npm run test:e2e`     | ✅ PASS | 21/21 E2E tests passed. Routes intact. |
| `npm run check`        | ✅ PASS | Pipeline composite script passes.      |

## Local Database Lifecycle

| Step                     | Result  | Notes                                                                     |
| ------------------------ | ------- | ------------------------------------------------------------------------- |
| `npm run supabase:start` | ✅ PASS | Docker containers start cleanly.                                          |
| `npm run db:reset`       | ✅ PASS | Applies `20260803215542_create_core_database.sql` and seeds successfully. |
| `npm run db:test`        | ✅ PASS | pgTAP executes and 6/6 test files pass (63 assertions).                   |
| `npm run db:types`       | ✅ PASS | Generates `types.ts` reflecting new DB state.                             |

## Schema Review

✅ **PASS**

- Exactly 5 core tables created (`profiles`, `flashcard_sets`, `flashcards`, `special_collections`, `special_collection_items`).
- UUIDs properly default to `gen_random_uuid()`.
- All timestamps use `timestamptz`.
- Explicit check constraints prevent empty or whitespace-only strings using `btrim()`.
- Position is constrained to `>= 0`.
- Missing analytic tables correctly excluded from this phase.
- Necessary and sufficient indexing provided.

## Trigger Security Review

✅ **PASS**

- `handle_new_user` safely handles `auth.users` insertion, correctly pulling only `display_name` via `raw_user_meta_data`.
- `security definer` functions explicitly use `set search_path = ''` mitigating hijack vectors.
- `set_updated_at` applies selectively only to tables having an `updated_at` column.

## Ownership Integrity

✅ **PASS**

- Database-level consistency enforced via composite foreign keys (e.g. `(user_id, set_id)` referencing `flashcard_sets (user_id, id)`).
- Cannot bypass ownership via RLS misconfiguration or direct updates because PostgreSQL constraints run independently of the executing role.

## RLS Test Matrix

| Operation                                 | Expected       | Actual         | Result  |
| ----------------------------------------- | -------------- | -------------- | ------- |
| Select own Profile/Set/Card/Collection    | Access Granted | Access Granted | ✅ PASS |
| Update own Profile/Set/Card/Collection    | Access Granted | Access Granted | ✅ PASS |
| Insert into own Set/Collection            | Access Granted | Access Granted | ✅ PASS |
| Delete own Set/Card/Collection            | Access Granted | Access Granted | ✅ PASS |
| Select/Update/Delete other's objects      | Access Denied  | Access Denied  | ✅ PASS |
| Cross-user inserts (e.g., A inserts to B) | Access Denied  | Access Denied  | ✅ PASS |

_(Note: Matrix verified through `npm run db:test` passing pgTAP assertions in `002_profiles.sql`, `003_flashcard_sets_ownership.sql`, `004_special_collections_ownership.sql`)_

## Constraint Test Matrix

✅ **PASS**
Verified via pgTAP `001_constraints.sql`:

- Empty/whitespace string blocks on sets and cards.
- Negative positions blocked.
- Duplicate case-insensitive collection names blocked.
- Valid Unicode/Vietnamese allowed.

## Cascade Test Matrix

✅ **PASS**
Verified via pgTAP `005_cascades.sql`:

- Set deletion propagates to flashcards.
- Flashcard deletion propagates to collection items.
- Collection deletion propagates to collection items.
- Auth User deletion cascades to profile and owned sets.

## Generated Types Review

✅ **PASS**

- No uncommitted modifications when running `npm run db:types`.
- Generated types map exactly to 5 tables.
- Typecheck and build pass cleanly against generated DB types.

## Documentation Review

✅ **PASS**

- `docs/DECISIONS/001-core-data-ownership.md` exactly corresponds to the implemented composite FK + RLS pattern.
- `docs/DATABASE.md` correctly models the current table structures.

## Findings

None. All checks passed.

## Recommended Next Step

Proceed to Phase 3: Setup Application Auth Flows (UI Integration).
