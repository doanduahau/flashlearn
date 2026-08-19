# ADR 002: Free-Tier Beta Deployment Architecture

## Context

CapyStudy is entering a small non-commercial beta phase for several dozen users.
The product needs a reliable, low-cost deployment that can be set up quickly and
maintained with minimal operational overhead. The team must decide on the hosting
and infrastructure stack for the beta period.

## Decision

The following architecture is approved for the free-tier beta:

| Concern                       | Choice        |
| ----------------------------- | ------------- |
| Application hosting           | Vercel Hobby  |
| Database and Auth             | Supabase Free |
| Production email confirmation | Disabled      |
| Custom SMTP                   | Deferred      |
| Password recovery             | Deferred      |
| Render                        | Not used      |
| AI services                   | Not used      |
| Original imported files       | Not persisted |

## Benefits

1. **Low cost.** Vercel Hobby and Supabase Free are both free-tier eligible, keeping
   the beta cost at zero.
2. **Fast setup.** Supabase Free provides Auth and PostgreSQL out of the box; Vercel
   deploys directly from the Git repository.
3. **No SMTP maintenance.** Disabling production email confirmation removes the need
   for a transactional email service during the beta.
4. **Simple architecture.** No Render, no custom SMTP, no AI integration. The stack
   remains small and well understood.
5. **Data ownership.** Supabase Free projects keep data within the Supabase ecosystem,
   and RLS enforces ownership at the database level.
6. **Easy rollback.** Vercel and Supabase both support instant rollback to previous
   deployments.

## Tradeoffs

1. **Unverified email addresses.** Without production email confirmation, users can
   register with nonexistent email addresses. This may lead to spam registrations.
2. **No password recovery.** Password recovery is deferred, so users who lose access
   to their account during the beta cannot recover it.
3. **Limited abuse prevention.** Without email verification and CAPTCHA, the beta is
   vulnerable to automated registrations.
4. **Free-tier quotas.** Supabase Free has row limits, bandwidth limits, and project
   limits that may be exceeded if the beta grows unexpectedly.
5. **Operational monitoring required.** Free-tier Supabase projects do not include
   automated backups or alerting. The team must monitor quotas and export data
   separately.
6. **No email deliverability guarantees.** Without SMTP configuration, transactional
   emails (like password reset, if added later) would rely on Supabase's default
   email delivery, which may have deliverability issues.

## Conditions for Reconsideration

This architecture should be revisited when:

- Real public users require verified email addresses.
- Password recovery becomes a requirement.
- Spam registrations become a problem.
- Email delivery becomes necessary for the product.
- Free-tier database or bandwidth limits are approached.
- The project becomes commercial.

## Alternatives Considered

### Render + Supabase Free

Render was considered for application hosting but deferred. Render's free tier has
limitations (spin-down after inactivity) that are unsuitable for a beta where users
expect consistent availability.

### Vercel Pro + Supabase Pro

Upgrading to paid tiers was considered but deferred until free-tier limits are
insufficient. The beta scope is small enough that free tiers are sufficient.

### Custom SMTP with Free Tier

A free SMTP service (e.g., Resend free tier) was considered for enabling production
email confirmation. However, adding SMTP introduces operational complexity that is
not justified for a small beta. Email confirmation will be disabled in production
and enabled locally through Mailpit.
