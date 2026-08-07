export type StreakComputation = {
  current: number;
  longest: number;
  completedToday: boolean;
};

/**
 * Derives streak totals from immutable local activity dates.
 *
 * A streak day exists when the user completed a quiz on that immutable local date.
 * The current streak ends today when today is active, otherwise yesterday when
 * active, and stops at the first missing day. This mirrors the server rule exactly.
 */
export function computeStreaks(activeDates: Iterable<string>, today: string): StreakComputation {
  const active = Array.from(new Set(activeDates));
  const activeSet = new Set(active);
  const completedToday = activeSet.has(today);

  let current = 0;
  let cursor = completedToday ? today : dayStep(today, -1);
  while (activeSet.has(cursor)) {
    current += 1;
    cursor = dayStep(cursor, -1);
  }

  const sorted = active.slice().sort();
  let longest = 0;
  if (sorted.length > 0) {
    let run = 1;
    longest = 1;
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = new Date(`${sorted[index - 1]}T00:00:00Z`).getTime();
      const currentDate = new Date(`${sorted[index]}T00:00:00Z`).getTime();
      if (currentDate - previous === dayMS) {
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 1;
      }
    }
  }

  return { current, longest, completedToday };
}

const dayMS = 86_400_000;

function dayStep(base: string, delta: number): string {
  const [year, month, day] = base.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return date.toISOString().slice(0, 10);
}
