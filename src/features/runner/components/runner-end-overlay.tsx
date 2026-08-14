import { Button } from "@/components/ui/button";
import { mascotAssetPath } from "@/features/mascot/utils/mascot-asset";
import type { MascotLevel, MascotState } from "@/features/mascot/types/mascot-types";
import { formatRunnerTime } from "../utils/format-runner-time";

export function RunnerEndOverlay({
  status,
  elapsedMs,
  level,
  mascotState,
  onBack,
}: Readonly<{
  status: "game-over" | "completed";
  elapsedMs: number;
  level: MascotLevel;
  mascotState: MascotState;
  onBack: () => void;
}>) {
  const heading = status === "game-over" ? "Hết mạng!" : "Hoàn thành!";

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/95 px-6 text-center">
      <img
        src={mascotAssetPath(level, mascotState)}
        alt=""
        className="size-28"
        aria-hidden="true"
      />
      <h2 className="text-xl font-bold sm:text-2xl">{heading}</h2>
      {status === "completed" ? (
        <p className="text-sm text-text-secondary">Thời gian {formatRunnerTime(elapsedMs)}</p>
      ) : null}
      <Button type="button" className="mt-2" onClick={onBack}>
        Quay lại
      </Button>
    </div>
  );
}
