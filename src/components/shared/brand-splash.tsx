export function BrandSplash({ title }: Readonly<{ title?: string }>) {
  return (
    <main
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 p-6"
      role="status"
      aria-label={title || "Đang tải trang"}
    >
      <span className="sr-only">{title || "Đang tải trang..."}</span>
      <div className="splash-in flex items-center justify-center rounded-full bg-primary-soft p-6 sm:p-7">
        <BrandLogo className="size-24 object-contain sm:size-28" />
      </div>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="splash-dot size-2.5 rounded-full bg-primary" />
        <span className="splash-dot size-2.5 rounded-full bg-primary [animation-delay:150ms]" />
        <span className="splash-dot size-2.5 rounded-full bg-primary [animation-delay:300ms]" />
      </div>
    </main>
  );
}
import { BrandLogo } from "@/components/shared/brand-logo";
