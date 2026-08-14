"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { startQuiz } from "@/features/quiz/server/actions";
import { QUIZ_MIN_QUESTIONS, QUIZ_MAX_QUESTIONS } from "@/features/quiz/schemas/quiz-schema";
import { cn } from "@/lib/utils";

const MATCH_MIN = 12;
const MATCH_COUNTS = [12, 18, 24] as const;
type MatchCount = (typeof MATCH_COUNTS)[number];

const QUIZ_QUICK_COUNTS = [10, 20, 30, 50];

export type QuizModeSelectSource = {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
};

export type QuizModeSelectProps = {
  source: QuizModeSelectSource;
  quizTotal: number;
  quizWrong: number;
  quizUncovered: number;
  matchEligible: number;
  matchAvailableCounts: number[];
  backHref: string;
};

function autoQuizMode(
  wrong: number,
  uncovered: number,
  count: number,
): "wrong_answers" | "never_tested" | "balanced" {
  if (wrong >= count) return "wrong_answers";
  if (uncovered >= count) return "never_tested";
  return "balanced";
}

const CARD_CLS =
  "flex flex-col rounded-2xl border border-border-soft bg-surface p-4 shadow-soft sm:p-5";
const PRIMARY_BTN =
  "min-h-12 w-full rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-opacity";

function requirementMsg(min: number, count: number): string {
  return `Cần tối thiểu ${min} thẻ — phạm vi hiện có ${count} thẻ`;
}

export function QuizModeSelect({
  source,
  quizTotal,
  quizWrong,
  quizUncovered,
  matchEligible,
  matchAvailableCounts,
  backHref,
}: Readonly<QuizModeSelectProps>) {
  const router = useRouter();
  const [quizExpanded, setQuizExpanded] = useState(false);
  const [matchExpanded, setMatchExpanded] = useState(false);
  const [quizCount, setQuizCount] = useState(QUIZ_MIN_QUESTIONS);
  const [matchCount, setMatchCount] = useState<MatchCount>(MATCH_COUNTS[0]);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quizEnabled = quizTotal >= QUIZ_MIN_QUESTIONS;
  const matchEnabled = matchEligible >= MATCH_MIN && matchAvailableCounts.length > 0;

  // Build quiz count options
  const quizOptions = [
    ...QUIZ_QUICK_COUNTS.filter((v) => v < quizTotal).map((v) => ({ value: v, label: String(v) })),
    ...(quizTotal >= 1 && quizTotal <= QUIZ_MAX_QUESTIONS
      ? [{ value: quizTotal, label: `Tất cả ${quizTotal}` }]
      : []),
  ];
  const effectiveQuizCount = quizOptions.some((o) => o.value === quizCount)
    ? quizCount
    : (quizOptions[0]?.value ?? QUIZ_MIN_QUESTIONS);

  function buildMatchQuery(count: number): string {
    const q = new URLSearchParams();
    if (source.all) q.set("all", "1");
    if (source.setIds.length) q.set("sets", source.setIds.join(","));
    if (source.collectionIds.length) q.set("collections", source.collectionIds.join(","));
    q.set("count", String(count));
    q.set("filter", "random");
    return q.toString();
  }

  function startMatch(count: number): void {
    router.push(`/match/session?${buildMatchQuery(count)}`);
  }

  function handleStartQuiz(): void {
    setQuizError(null);
    startTransition(async () => {
      const result = await startQuiz({
        all: source.all,
        setIds: source.setIds,
        collectionIds: source.collectionIds,
        mode: autoQuizMode(quizWrong, quizUncovered, effectiveQuizCount),
        questionCount: effectiveQuizCount,
      });
      if (!result.ok || !result.sessionId) {
        setQuizError(result.ok ? "Không thể tạo bài kiểm tra." : result.error);
        return;
      }
      router.push(`/quiz/${result.sessionId}`);
    });
  }

  return (
    <section aria-label="Chọn chế độ kiểm tra" className="flex flex-1 flex-col gap-3">
      <div className="flex justify-start">
        <BackButton fallbackHref={backHref} label="Quay lại chọn nguồn" />
      </div>

      <div className="flex flex-col gap-3">
        {/* Trắc nghiệm card */}
        <article className={cn(CARD_CLS, !quizEnabled && "opacity-60")}>
          <div className="flex items-center gap-3">
            <MascotImage
              level={1}
              state="normal"
              size={96}
              className="size-24 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold">Trắc nghiệm</h2>
              <p className="text-sm text-text-secondary">Chọn đáp án đúng trong 4 lựa chọn.</p>
            </div>
            <p className="shrink-0 text-sm font-medium">{quizTotal} thẻ</p>
          </div>

          {quizEnabled ? (
            quizExpanded ? (
              <div className="mt-auto flex flex-col gap-2 pt-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn số câu">
                  {quizOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        "min-h-10 rounded-xl border border-border-soft px-4 text-sm",
                        effectiveQuizCount === opt.value &&
                          "border-primary bg-primary-soft font-semibold",
                      )}
                      aria-pressed={effectiveQuizCount === opt.value}
                      onClick={() => setQuizCount(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={PRIMARY_BTN}
                  disabled={pending}
                  onClick={handleStartQuiz}
                >
                  {pending ? "Đang tạo…" : "Bắt đầu"}
                </button>
                {quizError ? (
                  <p role="alert" className="text-center text-sm text-danger">
                    {quizError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-auto pt-3">
                <button
                  type="button"
                  aria-label="Bắt đầu Trắc nghiệm"
                  className={PRIMARY_BTN}
                  onClick={() => setQuizExpanded(true)}
                >
                  Bắt đầu
                </button>
              </div>
            )
          ) : (
            <p className="mt-auto pt-3 text-center text-sm text-danger">
              {requirementMsg(QUIZ_MIN_QUESTIONS, quizTotal)}
            </p>
          )}
        </article>

        {/* Match card */}
        <article className={cn(CARD_CLS, !matchEnabled && "opacity-60")}>
          <div className="flex items-center gap-3">
            <MascotImage
              level={1}
              state="thinking"
              size={64}
              className="size-16 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold">Match</h2>
              <p className="text-sm text-text-secondary">Lật ô và ghép đúng cặp thẻ.</p>
            </div>
            <p className="shrink-0 text-sm font-medium">{matchEligible} thẻ</p>
          </div>

          {matchEnabled ? (
            matchExpanded ? (
              <div className="mt-auto flex flex-col gap-2 pt-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn số câu">
                  {matchAvailableCounts.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        "min-h-10 rounded-xl border border-border-soft px-4 text-sm",
                        matchCount === c && "border-primary bg-primary-soft font-semibold",
                      )}
                      aria-pressed={matchCount === c}
                      onClick={() => setMatchCount(c as MatchCount)}
                    >
                      {c} câu
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={PRIMARY_BTN}
                  onClick={() => startMatch(matchCount)}
                >
                  Bắt đầu
                </button>
              </div>
            ) : (
              <div className="mt-auto pt-3">
                <button
                  type="button"
                  className={PRIMARY_BTN}
                  onClick={() => setMatchExpanded(true)}
                >
                  Bắt đầu
                </button>
              </div>
            )
          ) : (
            <p className="mt-auto pt-3 text-center text-sm text-danger">
              {requirementMsg(MATCH_MIN, matchEligible)}
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
