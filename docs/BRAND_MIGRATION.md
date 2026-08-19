# CapyStudy brand migration

The public product name is **CapyStudy**. This migration changes the app name,
package name, email template, telemetry service name and current engineering
documentation without changing user data, routes or public-share tokens.

## Compatibility

`CAPYSTUDY_ENVIRONMENT` is the canonical runtime environment variable.
`FLASHLEARN_ENVIRONMENT` remains supported only as a deprecated compatibility
alias. If both are set, they must have the same value; remove the legacy name
after every deployed environment uses the CapyStudy name.

Redis rate-limit and circuit-breaker keys deliberately retain their
`flashlearn:` namespace. They are operational state rather than public
branding, and preserving the namespace prevents an active protection window
from resetting during deployment.

Database migration namespaces and the persisted `flashlearn-v1` FSRS parameter
set are immutable historical identifiers. Do not rename them: doing so would
break migration history or make existing scheduling rows appear incompatible.

## Required external changes

- [ ] Add `CAPYSTUDY_ENVIRONMENT` to development, staging and production; keep
      the legacy variable only during the transition.
- [ ] Rename the Vercel project and deployment labels if desired; deploy staging
      before production using the same commit.
- [ ] Update the Supabase Auth email template and subject, Site URL and redirect
      URLs for the CapyStudy domain.
- [ ] Update Google OAuth consent-screen branding, JavaScript origins and redirect
      URLs; retain the old origin until its redirect period ends.
- [ ] Rename or retag the Sentry project and update alert routing without losing
      access to historical FlashLearn incidents.
- [ ] Keep the old domain redirecting permanently to the CapyStudy domain and
      verify public share URLs after the redirect.
- [ ] Update Upstash, backup, status-page and incident-management labels.

## Verification

After external changes, run the staging smoke check, confirm Sentry receives a
test event tagged `service=capystudy`, call both health endpoints, and complete
the authentication, import and public-share smoke flows using the CapyStudy
domain.
