# Routes

## Public Routes

| Route           | Description                      |
| --------------- | -------------------------------- |
| `/`             | Landing page                     |
| `/sign-in`      | Email/password sign-in           |
| `/sign-up`      | Email/password sign-up           |
| `/check-email`  | Confirmation email sent page     |
| `/auth/confirm` | Email confirmation handler (SSR) |
| `/auth/error`   | Auth error page                  |

## Authenticated Routes

| Route                         | Description                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`                  | Tổng quan: dashboard plus explicit import/manual-set creation actions                                                    |
| `/sets?tab=regular`           | Bộ flashcard: regular-set list (search, pagination and card counts)                                                      |
| `/sets?tab=special`           | Bộ flashcard: special-collection list (independent search, pagination and empty state)                                   |
| `/sets/[setId]`               | Set detail: rename/delete set, add/edit/delete cards, card search and pagination, per-card special-collection membership |
| `/collections/[collectionId]` | Special collection detail: rename/delete collection, card list with original set name and remove-membership              |
| `/study`                      | Choose study scope (all cards or specific sets/collections)                                                              |
| `/study/session`              | Flashcard study session (deterministic source-query route, optional `seed`)                                              |
| `/quiz?tab=create`            | Kiểm tra: quiz setup, source selection, mode, unique count and question count                                            |
| `/quiz?tab=history`           | Kiểm tra: current-user completed quiz history                                                                            |
| `/quiz/[attemptId]`           | Take a quiz                                                                                                              |
| `/quiz/[attemptId]/result`    | Quiz result                                                                                                              |
| `/profile?tab=profile`        | Cá nhân: profile summary                                                                                                 |
| `/profile?tab=statistics`     | Cá nhân: server-rendered streak and completed-quiz statistics                                                            |
| `/profile?tab=settings`       | Cá nhân: settings (read-only email, editable display name and IANA timezone)                                             |

## Compatibility Redirects

| Legacy route   | Redirect destination       |
| -------------- | -------------------------- |
| `/import`      | `/dashboard?create=import` |
| `/collections` | `/sets?tab=special`        |
| `/history`     | `/quiz?tab=history`        |
| `/statistics`  | `/profile?tab=statistics`  |
| `/settings`    | `/profile?tab=settings`    |

## Route Protection

All routes inside the `(app)` route group are protected. Unauthenticated requests are redirected to `/sign-in` with a safe `next` parameter. Authenticated requests to guest-only pages (`/sign-in`, `/sign-up`, `/check-email`) are redirected to `/dashboard`.

The route protection is enforced at two levels:

1. **Proxy (`src/proxy.ts`):** Early redirect for improved UX.
2. **App layout (`(app)/layout.tsx`):** Authoritative server-side check.
