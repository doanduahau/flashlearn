# Authentication

## Auth Architecture

FlashLearn uses Supabase Auth with email and password authentication. The authentication flow is built on top of the existing Supabase SSR client infrastructure (`@supabase/ssr`) and cookie-based session management.

### Key Principles

1. **Server-first.** Auth state is verified on the server. Client Components never directly query the database for auth-sensitive data.
2. **Cookie-based sessions.** Sessions are managed through HTTP-only cookies set by the Supabase SSR client. The `src/proxy.ts` middleware refreshes sessions on every request.
3. **Claims-based auth checks.** The application uses `supabase.auth.getClaims()` for authentication checks, not `getSession()`. `getUser()` is only used where the latest full Auth user record is actually required (e.g., displaying the user's email in the app shell).
4. **Separation of concerns.** Browser and server Supabase clients remain separate. The server client is never imported into Client Components.

### Cookie and Proxy Responsibilities

- **Cookies:** Supabase Auth stores the session in browser cookies (`sb-access-token`, `sb-refresh-token`). These are automatically managed by the Supabase SSR client.
- **Proxy (`src/proxy.ts`):** The proxy middleware runs on every request, refreshes the session by calling `getClaims()`, and enforces route protection. Unauthenticated requests to protected routes are redirected to `/sign-in` with a safe `next` parameter. Authenticated requests to guest-only pages are redirected to `/dashboard`.

### Why `getClaims()` Is Used

`getClaims()` is preferred over `getSession()` for auth checks because:

- It returns the JWT claims which are the source of truth for the user's identity.
- It works consistently across server and middleware contexts.
- It avoids the overhead of fetching the full session object when only the user's identity is needed.

`getUser()` is used only in the `CurrentUser` component where the latest full Auth user record (including email) is needed for display purposes.

### Server-Side Route Protection

Route protection is enforced at two levels:

1. **Proxy (`src/proxy.ts`):** Runs on every request and checks auth state using `getClaims()`. Unauthenticated requests to protected routes are redirected to `/sign-in` with a safe `next` parameter. Authenticated requests to guest-only pages are redirected to `/dashboard`.
2. **App layout (`(app)/layout.tsx`):** Independently verifies authentication on the server side before rendering any authenticated content. This is the authoritative check.

## Sign-Up Flow

1. User submits the sign-up form with display name, email, and password.
2. The form data is validated with Zod on the server.
3. `supabase.auth.signUp()` is called with the validated email (trimmed and lowercased), password, and display name in user metadata.
4. If a session is returned immediately, the user is redirected to `/dashboard`.
5. If email confirmation is required (no session returned), the user is redirected to `/check-email`.
6. Field-level validation errors are returned to the form if validation fails.
7. Supabase errors are mapped to generic user-facing messages.

## Confirmation Flow

1. User clicks the confirmation link in their email.
2. The link opens `/auth/confirm?token_hash=...&type=email`.
3. The server-side route handler calls `supabase.auth.verifyOtp()` with the token hash and email OTP type.
4. If verification succeeds, the session is stored through SSR cookies and the user is redirected to `/dashboard`.
5. If verification fails or the token is expired, the user is redirected to `/auth/error`.
6. The `token_hash` is never logged or included in user-facing error messages.

## Sign-In Flow

1. User submits the sign-in form with email and password.
2. The form data is validated with Zod on the server.
3. `supabase.auth.signInWithPassword()` is called with the validated email and password.
4. On success, the user is redirected to the `next` destination (if safe) or `/dashboard`.
5. On failure, a generic "invalid credentials" message is shown.
6. The entered email is preserved after a recoverable error; the password is not redisplayed.

## Sign-Out Flow

1. User clicks the sign-out button in the app shell.
2. The form submits to the `signOut` server action.
3. The server action calls `supabase.auth.signOut({ scope: "local" })`.
4. On success, the session cookies are cleared and the user is redirected to `/sign-in`.
5. On failure, the user is still redirected to `/sign-in` without leaking internal errors.

## Safe Redirect Rules

The `sanitizeRedirect()` helper validates redirect destinations:

- Only internal paths (starting with `/`) are allowed.
- Absolute URLs (`https://...`, `http://...`) are rejected.
- Protocol-relative URLs (`//example.com`) are rejected.
- Backslash-based bypasses (`\evil.com`) are rejected.
- Guest-only auth routes (`/sign-in`, `/sign-up`, `/check-email`, `/auth/confirm`, `/auth/error`) are rejected as post-login destinations to prevent redirect loops.
- Invalid or malformed paths are rejected.

## Local Mailpit Testing

Local Supabase uses Mailpit for email delivery. To test the email confirmation flow:

1. Start the local Supabase stack: `npm run supabase:start`
2. Start the application: `npm run dev`
3. Register a new user through the sign-up form.
4. Obtain the Mailpit URL by running `npm run supabase:status` and checking the `MAILPIT_URL` value.
5. Find the confirmation email for the registered user.
6. Click the confirmation link in the email to complete the flow.
7. The application should redirect to `/dashboard` with an active session.

### Mailpit URL Discovery

The Mailpit port is configured in `supabase/config.toml` under `[inbucket].port`. Run `npm run supabase:status` to obtain the authoritative local Mailpit URL. Do not hardcode the Mailpit URL in production application logic.

## Hosted Supabase Redirect and Template Configuration

When deploying to a hosted Supabase project, the following configuration is required:

### Redirect URLs

Add the production URL to the Supabase Auth redirect URLs in the Supabase dashboard:

- `https://your-production-url.com/auth/confirm`
- `https://your-production-url.com`

### Email Templates

The confirmation email template is configured in `supabase/config.toml` with a custom HTML template at `supabase/templates/confirm-email.html`. When deploying to hosted Supabase, update the email template in the Supabase dashboard to match the local template.

### Site URL

Set the `site_url` in the Supabase Auth settings to the production URL.

## Deferred Auth Features

The following auth features are deferred to later phases:

- Password recovery/reset
- OAuth providers (Google, GitHub, etc.)
- Phone authentication
- Magic-link login
- Profile editing
- Resend confirmation email

## Security Considerations

- **No service-role keys in frontend code.** The server Supabase client uses the `ANON` key only.
- **No passwords in logs.** Server actions never log passwords, tokens, cookies, or confirmation hashes.
- **No raw Supabase errors to the browser.** All auth errors are mapped to generic user-facing messages.
- **No open redirects.** The `sanitizeRedirect()` helper validates all redirect destinations.
- **No trust of client-sent user IDs.** The server derives the user identity from the session.
- **RLS enforcement.** All data access is protected by Row Level Security policies keyed to `auth.uid()`.
