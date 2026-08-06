export default function StatisticsLoading() {
  return (
    <main
      className="mx-auto w-full max-w-5xl p-4 sm:p-8"
      aria-busy="true"
      aria-label="Đang tải thống kê"
    >
      <div className="h-9 w-56 animate-pulse rounded-xl bg-surface-subtle" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface-subtle" />
        ))}
      </div>
    </main>
  );
}
