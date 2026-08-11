// Public Supabase project refs are identifiers, not credentials. Keeping this
// value shared prevents local-development safety checks from drifting from the
// production diagnostics allowlist.
export const FLASHLEARN_PRODUCTION_SUPABASE_PROJECT_REF = "rtrllrlilupoesikeypt";

export function isFlashLearnProductionSupabaseUrl(value: string): boolean {
  try {
    return new URL(value).hostname === `${FLASHLEARN_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}
