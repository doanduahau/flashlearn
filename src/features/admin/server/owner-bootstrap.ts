import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

/**
 * Bootstrap the first admin owner via the service-role-only RPC. Deliberately
 * not `server-only` and takes the client as a parameter so the local/staging
 * operator runner can reuse it without importing Next.js server-only modules.
 * This path is never exposed to browsers; the RPC is revoked from every
 * non-service role and re-validates email confirmation + owner invariants.
 */

export type AdminCandidate = {
  userId: string;
  email: string;
  emailConfirmedAt: string | null;
  isActiveOwner: boolean;
};

export type BootstrapOwnerInput = {
  email: string;
  reason: string;
  correlationId?: string;
  actorUserId?: string;
};

export type BootstrapOwnerResult = {
  roleId: string;
  role: string;
  grantedAt: string;
  status: "created" | "idempotent";
};

export async function resolveAdminCandidate(
  client: Supabase,
  email: string,
): Promise<AdminCandidate | null> {
  const { data, error } = await client.rpc("get_admin_user_by_email", {
    p_email: email,
  });
  if (error) {
    throw new Error(`admin candidate lookup failed: ${error.message}`);
  }
  const row = data?.[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    emailConfirmedAt: row.email_confirmed_at,
    isActiveOwner: row.is_active_owner,
  };
}

export async function bootstrapOwner(
  client: Supabase,
  input: BootstrapOwnerInput,
): Promise<BootstrapOwnerResult> {
  const { data, error } = await client.rpc("bootstrap_owner", {
    p_email: input.email,
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
    p_actor_user_id: input.actorUserId,
  });
  if (error || !data?.[0]) {
    throw new Error(`owner bootstrap failed: ${error?.message ?? "no result"}`);
  }
  const row = data[0];
  return {
    roleId: row.role_id,
    role: row.role,
    grantedAt: row.granted_at,
    status: row.bootstrap_status === "idempotent" ? "idempotent" : "created",
  };
}
