import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  let config: ReturnType<typeof getSupabaseAnonConfig> | null = null;
  try {
    config = getSupabaseAnonConfig();
  } catch {
    // Supabase is not configured yet; the request passes through untouched.
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // The auth-aware client is wired up here as the Supabase foundation.
  // Session refresh and route guards will be added together with the
  // authentication feature.
  void supabase;

  return supabaseResponse;
}
