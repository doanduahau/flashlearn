import { dateInTimezone, type DailyActivityDetail } from "./month-activity";

export type InsightKind = "improvement" | "stable_more_activity" | "some_activity" | "no_activity";

export type SevenDayInsight = {
  kind: InsightKind;
  message: string;
};

function accuracy(correct: number, answers: number): number {
  return answers === 0 ? 0 : Math.round((correct / answers) * 100);
}

function aggregateActivity(details: DailyActivityDetail[]) {
  let questions = 0;
  let correct = 0;
  let quizCount = 0;
  for (const d of details) {
    questions += d.questions;
    correct += d.correct;
    quizCount += d.quizCount;
  }
  return { questions, correct, quizCount, accuracy: accuracy(correct, questions) };
}

export function getSevenDayBoundaries(today: string): {
  currentStart: string;
  previousStart: string;
} {
  const d = new Date(`${today}T12:00:00Z`);
  const currentEnd = new Date(d);
  const currentStart = new Date(d);
  currentStart.setUTCDate(d.getUTCDate() - 6);

  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousEnd.getUTCDate() - 6);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);

  return {
    currentStart: fmt(currentStart),
    previousStart: fmt(previousStart),
  };
}

export function computeSevenDayInsight(
  today: string,
  currentPeriod: DailyActivityDetail[],
  previousPeriod: DailyActivityDetail[],
): SevenDayInsight {
  const current = aggregateActivity(currentPeriod);
  const previous = aggregateActivity(previousPeriod);
  const currentAccuracy = current.accuracy;
  const previousAccuracy = previous.accuracy;
  const currentActivity = current.quizCount;
  const previousActivity = previous.quizCount;

  if (currentActivity === 0) {
    return {
      kind: "no_activity",
      message: "7 ngày vừa qua chưa có nhiều hoạt động học.",
    };
  }

  const hasEnoughComparisonData = current.questions >= 5 && previous.questions >= 5;

  if (hasEnoughComparisonData) {
    const improvement = currentAccuracy - previousAccuracy;

    if (improvement >= 5) {
      return {
        kind: "improvement",
        message: "Độ chính xác của bạn đã cải thiện trong 7 ngày vừa qua.",
      };
    }

    if (improvement > -5 && currentActivity > previousActivity) {
      return {
        kind: "stable_more_activity",
        message: "Bạn đang duy trì nhịp học tốt trong 7 ngày vừa qua.",
      };
    }
  }

  return {
    kind: "some_activity",
    message: "Bạn đã duy trì việc học trong 7 ngày vừa qua. Hãy tiếp tục nhé!",
  };
}
