# Deployment

## Free-Tier Beta Architecture

FlashLearn uses a free-tier architecture for the beta phase. See
`docs/DECISIONS/002-free-tier-beta-deployment.md` for the full ADR.

## Vercel Environment Variables

The following environment variables must be set in Vercel:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

### Why these are the only required variables

- `NEXT_PUBLIC_APP_URL` is used for constructing the `emailRedirectTo` URL in
  Supabase Auth and for redirecting users after sign-up and sign-in.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used
  by the Supabase browser and server clients to connect to the Supabase project.

The following variables are **not** required by the current architecture:

- `DATABASE_URL` — The application uses the Supabase client SDK, not a direct
  PostgreSQL connection string.
- `DIRECT_URL` — Not needed because the Supabase client handles connection
  management.
- `SUPABASE_SERVICE_ROLE_KEY` — The server client uses the anonymous publishable
  key; service role access is never exposed to the browser.
- Custom SMTP credentials — Production email confirmation is disabled for the
  beta; no SMTP is required.

## Supabase Production Setup

1. Create a Supabase Free project at https://supabase.com.
2. Apply migrations: `npm run db:reset` (local) or deploy migrations via the
   Supabase dashboard.
3. Configure the Site URL in Supabase Auth settings to the production URL.
4. Configure allowed redirect URLs in Supabase Auth settings (e.g.,
   `https://your-production-url.com/auth/confirm`).
5. Disable mandatory email confirmation for the beta in the Supabase Auth settings.
6. Do not configure custom SMTP.
7. Verify RLS remains enabled on all tables.
8. Configure the Vercel environment variables (see above).
9. Deploy the Next.js project to Vercel.
10. Run a production smoke test (see below).

## Production Smoke Test

1. Register a new account through the sign-up form.
2. Confirm registration enters the application immediately (no email check required).
3. Sign out.
4. Sign in again with the same credentials.
5. Verify protected routes (`/dashboard`, `/import`, `/sets`, `/collections`,
   `/study`, `/quiz`, `/history`, `/statistics`, `/settings`) are accessible.
6. Import will be tested only after that feature exists.

## Future Upgrade Triggers

Consider paid services or SMTP when:

- Real public users require verified email.
- Password recovery is needed.
- Spam registrations appear.
- Email delivery becomes necessary.
- Free database or bandwidth limits are approached.
- The project becomes commercial.
