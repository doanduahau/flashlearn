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

| Route                      | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| `/dashboard`               | Dashboard with overview                                                          |
| `/import`                  | Guided browser-memory CSV/XLSX import                                            |
| `/sets`                    | Regular flashcard set list (search + card counts)                                |
| `/sets/[setId]`            | Set detail: rename/delete set, add/edit/delete cards, card search and pagination |
| `/collections`             | List of special collections                                                      |
| `/collections/[id]`        | Special collection detail                                                        |
| `/study`                   | Choose study scope                                                               |
| `/study/[sessionId]`       | Flashcard study session                                                          |
| `/quiz`                    | Quiz setup                                                                       |
| `/quiz/[attemptId]`        | Take a quiz                                                                      |
| `/quiz/[attemptId]/result` | Quiz result                                                                      |
| `/history`                 | Quiz history                                                                     |
| `/statistics`              | Statistics and streak                                                            |
| `/settings`                | Profile and settings                                                             |

## Route Protection

All routes inside the `(app)` route group are protected. Unauthenticated requests are redirected to `/sign-in` with a safe `next` parameter. Authenticated requests to guest-only pages (`/sign-in`, `/sign-up`, `/check-email`) are redirected to `/dashboard`.

The route protection is enforced at two levels:

1. **Proxy (`src/proxy.ts`):** Early redirect for improved UX.
2. **App layout (`(app)/layout.tsx`):** Authoritative server-side check.
