export function RunnerBottomLabel({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border-t border-border-soft bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
      <p className="mx-auto max-w-3xl text-center text-base font-semibold leading-snug text-text-primary sm:text-lg">
        {label}
      </p>
    </div>
  );
}
