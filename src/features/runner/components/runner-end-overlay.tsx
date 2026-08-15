import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import type { MascotLevel, MascotState } from "@/features/mascot/types/mascot-types";
import { mascotAssetPath } from "@/features/mascot/utils/mascot-asset";
import { formatRunnerTime } from "../utils/format-runner-time";

export type RunnerBestTime = {
  bestMs: number;
  isNewBest: boolean;
};

export function RunnerEndOverlay({
  status,
  elapsedMs,
  level,
  mascotState,
  difficultyLabel,
  questionCount,
  completedCount,
  best,
  persistenceError,
  replayPending,
  fallbackHref,
  onReplay,
  onRetry,
}: Readonly<{
  status: "game-over" | "completed";
  elapsedMs: number;
  level: MascotLevel;
  mascotState: MascotState;
  difficultyLabel: string;
  questionCount: number;
  completedCount: number;
  best: RunnerBestTime | null;
  persistenceError: string | null;
  replayPending: boolean;
  fallbackHref: string;
  onReplay: (() => void) | null;
  onRetry: (() => void) | null;
}>) {
  const heading = status === "game-over" ? "Hết mạng!" : "Hoàn thành!";

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/95 px-6 text-center">
      <img
        src={mascotAssetPath(level, mascotState)}
        alt=""
        className="size-36"
        aria-hidden="true"
      />
      <h2 className="text-xl font-bold sm:text-2xl">{heading}</h2>
      {status === "completed" ? (
        <>
          <p className="text-sm text-text-secondary">Thời gian {formatRunnerTime(elapsedMs)}</p>
          {best ? (
            <p
              className={
                best.isNewBest ? "font-semibold text-primary-foreground" : "text-text-secondary"
              }
            >
              {best.isNewBest ? "Kỷ lục mới!" : "Kỷ lục:"} {formatRunnerTime(best.bestMs)}
            </p>
          ) : persistenceError === null ? (
            <p role="status" className="text-sm text-text-secondary">
              Đang lưu kỷ lục…
            </p>
          ) : null}
        </>
      ) : null}
      <p className="text-sm text-text-secondary">
        {status === "game-over" ? `Đã hoàn thành ${completedCount}/${questionCount} câu · ` : ""}
        {questionCount} câu · {difficultyLabel}
      </p>
      {persistenceError ? (
        <p role="alert" className="max-w-sm text-sm text-danger">
          {persistenceError}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {persistenceError && onRetry ? (
          <Button type="button" onClick={onRetry}>
            Thử lại
          </Button>
        ) : null}
        {onReplay ? (
          <Button type="button" variant="soft" onClick={onReplay} disabled={replayPending}>
            Chơi lại
          </Button>
        ) : null}
        <BackButton fallbackHref={fallbackHref} />
      </div>
    </div>
  );
}
