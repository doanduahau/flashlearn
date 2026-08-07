export type DailyActivityDetail = {
  date: string;
  quizCount: number;
  questions: number;
  correct: number;
};

export type CalendarDay = {
  date: string;
  day: number | null;
  active: boolean;
  future: boolean;
  detail: DailyActivityDetail | null;
  quizLevel: 0 | 1 | 2 | 3;
  flame: boolean;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  const cached = dateFormatterCache.get(timezone);
  if (cached) return cached;
  const next = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dateFormatterCache.set(timezone, next);
  return next;
}

export function dateInTimezone(value: Date, timezone: string): string {
  const parts = formatter(timezone).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function monthInTimezone(value: Date, timezone: string): string {
  return dateInTimezone(value, timezone).slice(0, 7);
}

export function addMonths(month: string, amount: number): string {
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function monthLabel(month: string, timezone: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: timezone,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, value - 1, 15, 12)));
}

export function monthDayLabel(date: string, timezone: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Heat intensity for the number of completed quizzes on a day.
 * 0 = no activity, 1 = one quiz, 2 = two/three, 3 = four or more.
 */
export function activityLevel(quizCount: number): 0 | 1 | 2 | 3 {
  if (quizCount <= 0) return 0;
  if (quizCount === 1) return 1;
  if (quizCount <= 3) return 2;
  return 3;
}

export function calendarDays(
  month: string,
  details: Map<string, DailyActivityDetail>,
  today: string,
  flameDates: Iterable<string> = [],
): CalendarDay[] {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const flameSet = new Set(flameDates);
  const blanks = Array.from({ length: leading }, () => ({
    date: "",
    day: null,
    active: false,
    future: false,
    detail: null,
    quizLevel: 0 as const,
    flame: false,
  }));
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const detail = details.get(date) ?? null;
    const future = date > today;
    return {
      date,
      day,
      active: detail !== null,
      future,
      detail,
      quizLevel: activityLevel(detail?.quizCount ?? 0),
      flame: flameSet.has(date),
    };
  });
  return [...blanks, ...days];
}
