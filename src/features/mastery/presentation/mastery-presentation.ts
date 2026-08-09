import type { MasteryStatus } from "@/features/mastery/types/mastery-types";
import { cn } from "@/lib/utils";

export const MASTERY_STATUS_LABELS: Record<MasteryStatus, string> = {
  untested: "Chưa học",
  review: "Cần ôn",
  learning: "Đang học",
  strong: "Đã nhớ",
};

export const MASTERY_STATUS_ORDER: readonly MasteryStatus[] = [
  "untested",
  "review",
  "learning",
  "strong",
];

export type MasteryPresentation = {
  label: string;
  cardClassName: string;
  indicatorClassName: string;
};

const MASTERY_PRESENTATIONS: Record<MasteryStatus, MasteryPresentation> = {
  untested: {
    label: MASTERY_STATUS_LABELS.untested,
    cardClassName: "border-mastery-untested-border bg-mastery-untested",
    indicatorClassName: "bg-mastery-untested-dot",
  },
  review: {
    label: MASTERY_STATUS_LABELS.review,
    cardClassName: "border-mastery-review-border bg-mastery-review",
    indicatorClassName: "bg-mastery-review-dot",
  },
  learning: {
    label: MASTERY_STATUS_LABELS.learning,
    cardClassName: "border-mastery-learning-border bg-mastery-learning",
    indicatorClassName: "bg-mastery-learning-dot",
  },
  strong: {
    label: MASTERY_STATUS_LABELS.strong,
    cardClassName: "border-mastery-strong-border bg-mastery-strong",
    indicatorClassName: "bg-mastery-strong-dot",
  },
};

export function getMasteryPresentation(status: MasteryStatus): MasteryPresentation {
  return MASTERY_PRESENTATIONS[status];
}

export function masteryCardClassName(status: MasteryStatus): string {
  return cn(
    "rounded-2xl border border-border-soft bg-surface p-4 sm:p-5",
    getMasteryPresentation(status).cardClassName,
  );
}
