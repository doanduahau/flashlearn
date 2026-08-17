export function PageSkeleton({ title }: Readonly<{ title?: string }>) {
  return (
    <main
      className="mx-auto w-full max-w-5xl p-3 sm:p-8"
      role="status"
      aria-label={title || "Đang tải trang"}
    >
      <span className="sr-only">{title || "Đang tải trang..."}</span>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="mt-4 h-28 animate-pulse rounded-2xl border border-border-soft bg-surface sm:h-36" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="h-24 animate-pulse rounded-xl border border-border-soft bg-surface sm:rounded-2xl" />
        <div className="h-24 animate-pulse rounded-xl border border-border-soft bg-surface sm:rounded-2xl" />
      </div>
      <div className="mt-3 h-40 animate-pulse rounded-2xl border border-border-soft bg-surface sm:rounded-3xl" />
    </main>
  );
}
