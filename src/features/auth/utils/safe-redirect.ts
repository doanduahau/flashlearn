import { ALL_GUEST_ROUTES } from "@/features/auth/utils/routes";

export function isSafeRedirect(destination: string): boolean {
  if (!destination) return false;
  if (destination.startsWith("//")) return false;
  if (destination.startsWith("http://")) return false;
  if (destination.startsWith("https://")) return false;
  if (destination.startsWith("\\")) return false;
  if (destination.includes("\\")) return false;
  if (!destination.startsWith("/")) return false;
  if (ALL_GUEST_ROUTES.includes(destination as (typeof ALL_GUEST_ROUTES)[number])) return false;
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
