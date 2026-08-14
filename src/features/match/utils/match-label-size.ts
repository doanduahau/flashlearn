export type MatchLabelTextSize =
  | "text-sm leading-snug sm:text-base"
  | "text-xs leading-snug sm:text-sm"
  | "text-[11px] leading-tight sm:text-xs"
  | "text-[10px] leading-tight sm:text-[11px]";

function displayWidth(label: string): number {
  return Array.from(label.trim()).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.5;
    if (/[WwmM@#%&]/.test(character)) return width + 1.4;
    return width + 1;
  }, 0);
}

/**
 * Keeps a fixed Match board cell readable without truncating its text unnecessarily.
 * Wide glyphs consume more of the cell space than ordinary characters.
 */
export function getMatchLabelTextSize(label: string): MatchLabelTextSize {
  const width = displayWidth(label);
  if (width <= 35) return "text-sm leading-snug sm:text-base";
  if (width <= 70) return "text-xs leading-snug sm:text-sm";
  if (width <= 100) return "text-[11px] leading-tight sm:text-xs";
  return "text-[10px] leading-tight sm:text-[11px]";
}
