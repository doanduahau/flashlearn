export const PROTECTED_ROUTES = [
  "/dashboard",
  "/import",
  "/sets",
  "/collections",
  "/study",
  "/quiz",
  "/history",
  "/statistics",
  "/settings",
] as const;

export const GUEST_ONLY_ROUTES = ["/sign-in", "/sign-up"] as const;

export const AUTH_ROUTES = ["/check-email", "/auth/confirm", "/auth/error"] as const;

export const ALL_GUEST_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/check-email",
  "/auth/confirm",
  "/auth/error",
] as const;

function stripQuery(pathname: string): string {
  const questionIndex = pathname.indexOf("?");
  return questionIndex !== -1 ? pathname.slice(0, questionIndex) : pathname;
}

export function isProtectedRoute(pathname: string): boolean {
  const path = stripQuery(pathname);
  return PROTECTED_ROUTES.some((route) => path === route || path.startsWith(route + "/"));
}

export function isGuestRoute(pathname: string): boolean {
  const path = stripQuery(pathname);
  return ALL_GUEST_ROUTES.some((route) => path === route || path.startsWith(route + "/"));
}

export function isAuthRoute(pathname: string): boolean {
  const path = stripQuery(pathname);
  return AUTH_ROUTES.some((route) => path === route || path.startsWith(route + "/"));
}
