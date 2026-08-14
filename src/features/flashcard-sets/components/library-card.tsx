import { MascotImage } from "@/features/mascot/components/mascot-image";

export function LibraryCard({
  open,
  children,
}: Readonly<{ open: boolean; children: React.ReactNode }>) {
  return (
    <section
      aria-label="Flash card của bạn"
      className="rounded-2xl border border-border-soft bg-surface p-4 sm:rounded-3xl sm:p-5"
    >
      <div className="flex items-center gap-3">
        <MascotImage
          level={1}
          state="normal"
          size={48}
          className="size-12 shrink-0 object-contain"
        />
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Flash card của bạn</h2>
          <p className="text-sm text-text-secondary">Bộ thường và bộ đặc biệt</p>
        </div>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
