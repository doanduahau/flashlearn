export function isSafeRedirect(destination: string): boolean {
  if (!destination) return false;
  if (destination.startsWith("//")) return false;
  if (destination.startsWith("http://")) return false;
  if (destination.startsWith("https://")) return false;
  if (destination.startsWith("\\")) return false;
  if (destination.includes("\\")) return false;
  if (!destination.startsWith("/")) return false;
  if (destination === "/sign-in") return false;
  if (destination === "/sign-up") return false;
  if (destination === "/check-email") return false;
  if (destination === "/auth/confirm") return false;
  if (destination === "/auth/error") return false;
  try {
    new URL(destination, "http://localhost");
  } catch {
    return false;
  }
  return true;
}

export function sanitizeRedirect(
  destination: string | null | undefined,
  fallback: string = "/dashboard",
): string {
  if (!destination || !isSafeRedirect(destination)) {
    return fallback;
  }
  return destination;
}
