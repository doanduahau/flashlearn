import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublishableConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  let config: ReturnType<typeof getSupabasePublishableConfig> | null = null;
  try {
    config = getSupabasePublishableConfig();
  } catch {
    return { response: supabaseResponse, claims: null, supabase: null };
  }

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
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

  const { data: claimsData } = await supabase.auth.getClaims();

  if (claimsData) {
    return { response: supabaseResponse, claims: claimsData, supabase };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { response: supabaseResponse, claims: { claims: user }, supabase };
  }

  return { response: supabaseResponse, claims: null, supabase };
}
