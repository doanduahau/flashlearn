import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { isGuestRoute, isProtectedRoute } from "@/features/auth/utils/routes";

type DetailResource =
  { table: "flashcard_sets"; id: string } | { table: "special_collections"; id: string };

const DETAIL_RESOURCE_PATH =
  /^\/(sets|collections)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function getDetailResource(pathname: string): DetailResource | null {
  const match = pathname.match(DETAIL_RESOURCE_PATH);
  if (!match) return null;

  return match[1] === "sets"
    ? { table: "flashcard_sets", id: match[2] }
    : { table: "special_collections", id: match[2] };
}

function notFoundResponse(request: NextRequest, sessionResponse: NextResponse): NextResponse {
  const response = NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
  for (const cookie of sessionResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { response: supabaseResponse, claims, supabase } = await updateSession(request);

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

  const detailResource = getDetailResource(pathname);
  if (isAuthenticated && supabase && detailResource) {
    // This indexed, RLS-scoped existence check happens before App Router begins
    // streaming, so unauthorized and deleted resources can return HTTP 404.
    const { data } = await supabase
      .from(detailResource.table)
      .select("id")
      .eq("id", detailResource.id)
      .maybeSingle();
    if (!data) return notFoundResponse(request, supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
