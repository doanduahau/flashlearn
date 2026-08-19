import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, env.NEXT_PUBLIC_APP_URL));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (!code && (!tokenHash || !type)) {
    return redirectTo("/auth/error?error=missing_params");
  }

  try {
    const supabase = await createClient();

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        logger.warn("auth.confirm_exchange_failed", { reason: error?.message });
        return redirectTo("/auth/error?error=confirmation_failed");
      }
      return redirectTo("/dashboard");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: type as "email",
    });

    if (error || !data.session) {
      logger.warn("auth.confirm_otp_failed", { reason: error?.message });
      return redirectTo("/auth/error?error=confirmation_failed");
    }

    return redirectTo("/dashboard");
  } catch {
    return redirectTo("/auth/error?error=confirmation_failed");
  }
}
