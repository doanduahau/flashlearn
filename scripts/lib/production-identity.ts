import { CAPYSTUDY_PRODUCTION_SUPABASE_PROJECT_REF } from "../../src/lib/supabase/production-project";

// Shared production Supabase identity guard for admin diagnostics scripts.
// Kept free of any write-capable imports so read-only runners (e.g. the
// production comparison command) can reuse the exact same hardened validation
// the reconciliation runner uses without importing write paths.

// Production project allowlist. This MUST be updated with the real CapyStudy
// production Supabase project ref before any runner will do anything. Keeping
// it empty fail-closes: runners refuse any project that is not explicitly
// allowlisted here. The ref is a public project identifier, not a secret.
export const ALLOWED_PRODUCTION_PROJECT_REFS = new Set([CAPYSTUDY_PRODUCTION_SUPABASE_PROJECT_REF]);

export type ProductionIdentity = {
  url: string;
  projectRef: string;
  serviceRoleKey: string;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const PROD_HOSTNAME_PATTERN = /^([a-z0-9]+)\.supabase\.co$/;

export type ProductionEnv = {
  CAPYSTUDY_PRODUCTION_SUPABASE_URL?: string;
  CAPYSTUDY_PRODUCTION_PROJECT_REF?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
};

export function resolveProductionIdentity(
  env: ProductionEnv,
  allowlist: ReadonlySet<string>,
): ProductionIdentity {
  const url = env.CAPYSTUDY_PRODUCTION_SUPABASE_URL;
  const projectRef = env.CAPYSTUDY_PRODUCTION_PROJECT_REF;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !projectRef || !serviceRoleKey) {
    const missing = [
      !url ? "CAPYSTUDY_PRODUCTION_SUPABASE_URL" : null,
      !projectRef ? "CAPYSTUDY_PRODUCTION_PROJECT_REF" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean);
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  validateProductionIdentity({ url, projectRef, serviceRoleKey }, allowlist);
  return { url, projectRef, serviceRoleKey };
}

export function validateProductionIdentity(
  identity: ProductionIdentity,
  allowlist: ReadonlySet<string>,
): void {
  let parsed: URL;
  try {
    parsed = new URL(identity.url);
  } catch {
    throw new Error(`CAPYSTUDY_PRODUCTION_SUPABASE_URL is not a valid URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`production Supabase URL must be https: (got ${parsed.protocol})`);
  }
  if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(`production Supabase URL must not point at ${parsed.hostname}`);
  }

  const match = PROD_HOSTNAME_PATTERN.exec(parsed.hostname);
  if (!match) {
    throw new Error(
      `unrecognized Supabase hostname ${parsed.hostname}; expected <ref>.supabase.co`,
    );
  }
  const hostRef = match[1];
  if (hostRef !== identity.projectRef) {
    throw new Error(
      `URL project ref "${hostRef}" does not match CAPYSTUDY_PRODUCTION_PROJECT_REF "${identity.projectRef}"`,
    );
  }
  if (!allowlist.has(identity.projectRef)) {
    throw new Error(`project ref "${identity.projectRef}" is not in the production allowlist`);
  }
}
