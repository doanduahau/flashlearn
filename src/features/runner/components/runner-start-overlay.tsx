export function RunnerStartOverlay({
  difficultyLabel,
  lives,
  onStart,
}: Readonly<{
  difficultyLabel: string;
  lives: number;
  onStart: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="Chạm để bắt đầu"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/95 px-6 text-center"
    >
      <span className="text-xl font-bold sm:text-2xl">Chạm để bắt đầu</span>
      <span className="text-sm text-text-secondary">
        {difficultyLabel} · {lives} mạng
      </span>
    </button>
  );
}
