import { getRunnerAnswerLabelTextSize } from "../utils/answer-label-size";

export function RunnerBottomLabel({ label }: Readonly<{ label: string }>) {
  const textSize = getRunnerAnswerLabelTextSize(label);

  return (
    <div className="border-t border-border-soft bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto flex h-20 max-w-3xl items-center justify-center">
        <p
          className={`${textSize} w-full break-words text-center font-semibold leading-snug text-text-primary [overflow-wrap:anywhere]`}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
