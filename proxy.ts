import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { isGuestRoute, isProtectedRoute } from "@/features/auth/utils/routes";

export async function proxy(request: NextRequest) {
  const { response: supabaseResponse, claims } = await updateSession(request);

  const isAuthenticated = claims !== null;
  const { pathname } = request.nextUrl;

  if (isAuthenticated && isGuestRoute(pathname)) {
    const redirectUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (!isAuthenticated && !isGuestRoute(pathname) && isProtectedRoute(pathname)) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
