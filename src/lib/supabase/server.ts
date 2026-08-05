import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublishableConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublishableConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; the proxy refreshes them on the response path.
        }
      },
    },
  });
}
