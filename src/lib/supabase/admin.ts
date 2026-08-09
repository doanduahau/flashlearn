import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/** Server-only client for RPCs that are intentionally unavailable to browsers. */
export function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServiceConfig();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
