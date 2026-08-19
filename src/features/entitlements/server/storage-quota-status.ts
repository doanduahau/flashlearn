import "server-only";

import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function hasStorageQuotaWarning(supabase: ServerClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_my_storage_quota_status");
  if (error) return false;
  const status = data?.[0];
  return status?.enforcement_mode === "warn" && status.has_recent_warning === true;
}
