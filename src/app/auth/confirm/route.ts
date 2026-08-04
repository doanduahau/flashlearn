import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (!code && (!tokenHash || !type)) {
    return NextResponse.redirect(new URL("/auth/error?error=missing_params", request.url));
  }

  try {
    const supabase = await createClient();

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        console.error("[confirm] Code exchange failed:", error?.message);
        return NextResponse.redirect(new URL("/auth/error?error=confirmation_failed", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: type as "email",
    });

    if (error || !data.session) {
      console.error("[confirm] OTP verification failed:", error?.message);
      return NextResponse.redirect(new URL("/auth/error?error=confirmation_failed", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch {
    return NextResponse.redirect(new URL("/auth/error?error=confirmation_failed", request.url));
  }
}
