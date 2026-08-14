import type { RunnerDifficulty, RunnerQuestion } from "../types/runner-types";
import { getRunnerDifficultyConfig, runnerDifficultyLabel } from "../utils/runner-difficulty";

export function RunnerSessionPlaceholder({
  questions,
  difficulty,
}: Readonly<{ questions: RunnerQuestion[]; difficulty: RunnerDifficulty }>) {
  const config = getRunnerDifficultyConfig(difficulty);
  const first = questions[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-foreground">
          {runnerDifficultyLabel(difficulty)}
        </span>
        <span className="text-sm text-text-secondary">{config.lives} mạng</span>
      </div>

      <p className="text-sm font-semibold text-text-secondary">Câu 1 / {questions.length}</p>

      {first ? (
        <section className="rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="text-base font-semibold sm:text-lg">{first.front}</h2>
          <ul className="mt-3 space-y-2" aria-label="Các lựa chọn">
            {first.choices.map((choice, index) => (
              <li
                key={`${first.flashcardId}:${index}`}
                className="rounded-xl border border-border-soft bg-surface-subtle px-3 py-2 text-sm sm:text-base"
              >
                {choice}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-text-secondary">Không có câu hỏi nào.</p>
      )}
    </div>
  );
}
