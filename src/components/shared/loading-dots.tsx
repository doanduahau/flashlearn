export function LoadingDots({ label }: Readonly<{ label?: string }>) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status">
      <span className="sr-only">{label || "Đang tải"}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="splash-dot size-1.5 rounded-full bg-primary" />
        <span className="splash-dot size-1.5 rounded-full bg-primary [animation-delay:150ms]" />
        <span className="splash-dot size-1.5 rounded-full bg-primary [animation-delay:300ms]" />
      </span>
    </span>
  );
}
