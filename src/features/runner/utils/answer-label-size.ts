export type RunnerAnswerLabelTextSize = "text-lg" | "text-base" | "text-sm" | "text-xs";

function displayWidth(label: string): number {
  return Array.from(label.trim()).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.5;
    if (/[WwmM@#%&]/.test(character)) return width + 1.4;
    return width + 1;
  }, 0);
}

/**
 * Keeps a fixed Runner answer-label area readable without truncating its text.
 * Wide glyphs consume more of the two-line label than ordinary characters.
 */
export function getRunnerAnswerLabelTextSize(label: string): RunnerAnswerLabelTextSize {
  const width = displayWidth(label);
  if (width <= 20) return "text-lg";
  if (width <= 40) return "text-base";
  if (width <= 60) return "text-sm";
  return "text-xs";
}
