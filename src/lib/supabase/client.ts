"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  const { url, anonKey } = getSupabaseAnonConfig();

  return createBrowserClient<Database>(url, anonKey);
}
