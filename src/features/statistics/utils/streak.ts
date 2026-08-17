export type StreakComputation = {
  current: number;
  longest: number;
  completedToday: boolean;
  /** True when the streak can be recovered with enough quiz completions today. */
  recoverable: boolean;
  /** How many quiz-mode completions are still needed to restore the streak. */
  needsRecoveryQuizzes: number;
};

const RECOVERY_QUIZ_COUNT = 3;

/**
 * Derives streak totals from immutable local activity dates.
 *
 * A streak day exists when the user completed any learning mode on that
 * immutable local date (the daily record exists). The current streak ends
 * today when today is active, otherwise yesterday when active, and stops at
 * the first missing day.
 *
 * Recovery rule (Task N13): a gap of exactly one day is recoverable. When the
 * user completes at least 3 quiz-mode sessions today (quiz/match/typing via
 * `todayQuizCount`), the streak is re-joined: today counts as one extra day on
 * top of the run that ended two days ago, and the missed day is skipped.
 * While the gap exists but fewer than 3 quizzes are done, `recoverable` is
 * true and the previous run is still shown as the current streak.
 */
export function computeStreaks(
  activeDates: Iterable<string>,
  today: string,
  todayQuizCount = 0,
): StreakComputation {
  const active = Array.from(new Set(activeDates));
  const activeSet = new Set(active);
  const completedToday = activeSet.has(today);

  const countRun = (cursor: string): number => {
    let run = 0;
    let key = cursor;
    while (activeSet.has(key)) {
      run += 1;
      key = dayStep(key, -1);
    }
    return run;
  };

  let current = 0;
  let recoverable = false;
  let needsRecoveryQuizzes = 0;

  if (completedToday) {
    if (activeSet.has(dayStep(today, -1))) {
      // Normal continuation: today and yesterday are both active.
      current = countRun(today);
    } else if (activeSet.has(dayStep(today, -2))) {
      // Exactly one missed day (yesterday) with activity today. Recovery
      // applies: 3+ quiz-mode completions today re-join the old run.
      const oldRun = countRun(dayStep(today, -2));
      if (todayQuizCount >= RECOVERY_QUIZ_COUNT) {
        current = oldRun + 1;
      } else {
        current = oldRun;
        recoverable = true;
        needsRecoveryQuizzes = Math.max(0, RECOVERY_QUIZ_COUNT - todayQuizCount);
      }
    } else {
      // A longer break ended today: the streak restarts from today.
      current = 1;
    }
  } else if (activeSet.has(dayStep(today, -1))) {
    // Today missing but yesterday active: the streak is still alive, waiting
    // on today (as before — not yet a recoverable gap).
    current = countRun(dayStep(today, -1));
  } else if (activeSet.has(dayStep(today, -2))) {
    // Gap of exactly one day (yesterday) with nothing done today yet.
    current = countRun(dayStep(today, -2));
    recoverable = true;
    needsRecoveryQuizzes = RECOVERY_QUIZ_COUNT;
  }
  // Otherwise (gap of 2+ days, or no history): current stays 0.

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

  // A recovered streak can exceed the physically consecutive calendar run
  // (the missed day is skipped), so the longest total never falls below it.
  if (current > longest) longest = current;

  return { current, longest, completedToday, recoverable, needsRecoveryQuizzes };
}

/**
 * Returns every immutable local date that belongs to the current consecutive
 * streak run, walked back from today (or yesterday when today is not active).
 * These are the days on which a streak flame should appear.
 */
export function computeStreakRun(activeDates: Iterable<string>, today: string): string[] {
  const active = new Set(activeDates);
  const cursor = active.has(today) ? today : dayStep(today, -1);
  const run: string[] = [];
  let key = cursor;
  while (active.has(key)) {
    run.push(key);
    key = dayStep(key, -1);
  }
  return run;
}

const dayMS = 86_400_000;

function dayStep(base: string, delta: number): string {
  const [year, month, day] = base.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return date.toISOString().slice(0, 10);
}
