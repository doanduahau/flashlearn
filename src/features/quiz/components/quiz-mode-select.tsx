"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
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
  matchEligible: number;
  matchAvailableCounts: number[];
  typingEligible: number;
  typingAvailableCounts: number[];
  backHref: string;
  mascotLevel: MascotLevel;
};

const CARD_CLS =
  "flex gap-3 rounded-2xl border border-border-soft bg-surface p-3 shadow-soft sm:p-4 min-h-[120px]";
const PRIMARY_BTN =
  "min-h-10 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-opacity whitespace-nowrap flex items-center justify-center";

function requirementMsg(min: number, count: number): string {
  return `Cần tối thiểu ${min} thẻ — phạm vi hiện có ${count} thẻ`;
}

export function QuizModeSelect({
  source,
  quizTotal,
  matchEligible,
  matchAvailableCounts,
  typingEligible,
  typingAvailableCounts,
  backHref,
  mascotLevel,
}: Readonly<QuizModeSelectProps>) {
  const router = useRouter();
  const [quizExpanded, setQuizExpanded] = useState(false);
  const [matchExpanded, setMatchExpanded] = useState(false);
  const [typingExpanded, setTypingExpanded] = useState(false);
  const [quizCount, setQuizCount] = useState(QUIZ_MIN_QUESTIONS);
  const [matchCount, setMatchCount] = useState<MatchCount>(MATCH_COUNTS[0]);
  const [typingCount, setTypingCount] = useState(QUIZ_MIN_QUESTIONS);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quizEnabled = quizTotal >= QUIZ_MIN_QUESTIONS;
  const matchEnabled = matchEligible >= MATCH_MIN && matchAvailableCounts.length > 0;
  const typingEnabled = typingEligible >= QUIZ_MIN_QUESTIONS && typingAvailableCounts.length > 0;

  const effectiveTypingCount = typingAvailableCounts.includes(typingCount)
    ? typingCount
    : (typingAvailableCounts[0] ?? QUIZ_MIN_QUESTIONS);

  // Build quiz count options
  const quizOptions = [
    ...QUIZ_QUICK_COUNTS.filter((v) => v < quizTotal).map((v) => ({ value: v, label: String(v) })),
    ...(quizTotal >= 1 && quizTotal <= QUIZ_MAX_QUESTIONS
      ? [{ value: quizTotal, label: String(quizTotal) }]
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
    return q.toString();
  }

  function startMatch(count: number): void {
    router.push(`/match/session?${buildMatchQuery(count)}`);
  }

  function startTyping(count: number): void {
    router.push(`/typing/session?${buildMatchQuery(count)}`);
  }

  function handleStartQuiz(): void {
    setQuizError(null);
    startTransition(async () => {
      const result = await startQuiz({
        all: source.all,
        setIds: source.setIds,
        collectionIds: source.collectionIds,
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
        <BackButton fallbackHref={backHref} />
      </div>

      <div className="flex flex-col gap-3">
        {/* Trắc nghiệm card */}
        <article className={cn(CARD_CLS, !quizEnabled && "opacity-60")}>
          <div className="flex w-[30%] shrink-0 items-center justify-center">
            <MascotImage
              level={mascotLevel}
              state="normal"
              size={96}
              className="size-24 object-contain"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold">Trắc nghiệm</h2>
                <p className="text-sm text-text-secondary">Chọn đáp án đúng</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-text-primary">
                {quizTotal} thẻ
              </span>
            </div>

            {quizEnabled ? (
              quizExpanded ? (
                <div className="flex flex-col gap-2 pt-1 border-t border-border-soft/60">
                  <div
                    className="flex w-full items-center justify-between gap-1.5"
                    role="group"
                    aria-label="Chọn số câu"
                  >
                    {quizOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={cn(
                          "min-h-8 flex-1 rounded-lg border border-border-soft px-1.5 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:min-h-9 sm:text-sm",
                          effectiveQuizCount === opt.value &&
                            "border-primary bg-primary-soft font-semibold text-primary-foreground",
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
                    <p role="alert" className="text-center text-xs text-danger">
                      {quizError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div>
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
              <p className="text-center text-xs text-danger">
                {requirementMsg(QUIZ_MIN_QUESTIONS, quizTotal)}
              </p>
            )}
          </div>
        </article>

        {/* Match card */}
        <article className={cn(CARD_CLS, !matchEnabled && "opacity-60")}>
          <div className="flex w-[30%] shrink-0 items-center justify-center">
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={96}
              className="size-24 object-contain"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold">Match</h2>
                  <p className="text-sm text-text-secondary">ghép 2 thẻ phù hợp</p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-text-primary">
                {matchEligible} thẻ
              </span>
            </div>

            {matchEnabled ? (
              matchExpanded ? (
                <div className="flex flex-col gap-2 pt-1 border-t border-border-soft/60">
                  <div
                    className="flex w-full items-center justify-between gap-1.5"
                    role="group"
                    aria-label="Chọn số câu"
                  >
                    {matchAvailableCounts.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          "min-h-8 flex-1 rounded-lg border border-border-soft px-1.5 py-1 text-xs font-medium transition-colors sm:min-h-9 sm:text-sm",
                          matchCount === c &&
                            "border-primary bg-primary-soft font-semibold text-primary-foreground",
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
                <div>
                  <button
                    type="button"
                    aria-label="Bắt đầu Match"
                    className={PRIMARY_BTN}
                    onClick={() => setMatchExpanded(true)}
                  >
                    Bắt đầu
                  </button>
                </div>
              )
            ) : (
              <p className="text-center text-xs text-danger">
                {requirementMsg(MATCH_MIN, matchEligible)}
              </p>
            )}
          </div>
        </article>

        {/* Nhập đáp án card */}
        <article className={cn(CARD_CLS, !typingEnabled && "opacity-60")}>
          <div className="flex w-[30%] shrink-0 items-center justify-center">
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={96}
              className="size-24 object-contain"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold">Nhập đáp án</h2>
                <p className="text-sm text-text-secondary">Gõ đáp án theo cách của bạn</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-text-primary">
                {typingEligible} thẻ
              </span>
            </div>

            {typingEnabled ? (
              typingExpanded ? (
                <div className="flex flex-col gap-2 pt-1 border-t border-border-soft/60">
                  <div
                    className="flex w-full items-center justify-between gap-1.5"
                    role="group"
                    aria-label="Chọn số câu"
                  >
                    {typingAvailableCounts.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          "min-h-8 flex-1 rounded-lg border border-border-soft px-1.5 py-1 text-xs font-medium transition-colors sm:min-h-9 sm:text-sm",
                          effectiveTypingCount === c &&
                            "border-primary bg-primary-soft font-semibold text-primary-foreground",
                        )}
                        aria-pressed={effectiveTypingCount === c}
                        onClick={() => setTypingCount(c)}
                      >
                        {c} câu
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={PRIMARY_BTN}
                    onClick={() => startTyping(effectiveTypingCount)}
                  >
                    Bắt đầu
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    aria-label="Bắt đầu Nhập đáp án"
                    className={PRIMARY_BTN}
                    onClick={() => setTypingExpanded(true)}
                  >
                    Bắt đầu
                  </button>
                </div>
              )
            ) : (
              <p className="text-center text-xs text-danger">
                {requirementMsg(QUIZ_MIN_QUESTIONS, typingEligible)}
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
