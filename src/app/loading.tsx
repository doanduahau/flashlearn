export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
        role="status"
        aria-label="Đang tải"
      />
    </div>
  );
}
