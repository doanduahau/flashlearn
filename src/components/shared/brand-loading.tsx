export function BrandLoading({ title }: Readonly<{ title?: string }>) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-6"
      role="status"
      aria-label={title || "Đang tải"}
    >
      <span className="sr-only">{title || "Đang tải"}</span>
      <div className="splash-in flex items-center justify-center rounded-2xl bg-primary-soft p-3">
        <img
          src="/mascot/logo.png"
          alt=""
          aria-hidden="true"
          className="size-10 object-contain sm:size-12"
        />
      </div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="splash-dot size-2 rounded-full bg-primary" />
        <span className="splash-dot size-2 rounded-full bg-primary [animation-delay:150ms]" />
        <span className="splash-dot size-2 rounded-full bg-primary [animation-delay:300ms]" />
      </div>
    </div>
  );
}
