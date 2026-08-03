"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  const { url, publishableKey } = getSupabasePublishableConfig();

  return createBrowserClient<Database>(url, publishableKey);
}
