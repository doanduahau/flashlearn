import { ClipboardPaste, FileText, Sheet, SquarePen } from "lucide-react";
import Link from "next/link";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import { cn } from "@/lib/utils";
import {
  removeSearchParamHref,
  type RouteSearchParams,
  updateSearchParamHref,
} from "@/lib/pagination";

export type CreateMode = "file" | "manual" | "paste" | "google_sheets" | null;

const SOURCE_CHIPS: Array<{
  mode: Exclude<CreateMode, null>;
  label: string;
  icon: typeof ClipboardPaste;
  createValue: string;
}> = [
  { mode: "paste", label: "Dán nội dung", icon: ClipboardPaste, createValue: "paste" },
  { mode: "google_sheets", label: "Google Sheets", icon: Sheet, createValue: "google_sheets" },
  { mode: "file", label: "Tài liệu", icon: FileText, createValue: "document" },
  { mode: "manual", label: "Thủ công", icon: SquarePen, createValue: "manual" },
];

export function CreateSetCard({
  mode,
  searchParams,
  children,
}: Readonly<{
  mode: CreateMode;
  searchParams: RouteSearchParams;
  children: React.ReactNode;
}>) {
  const closeHref = removeSearchParamHref("/sets", searchParams, "create");

  return (
    <section
      aria-label="Tạo Flash card"
      className="rounded-2xl border border-border-soft bg-surface-subtle p-4 sm:rounded-3xl sm:p-5"
    >
      <div className="flex items-center gap-3">
        <MascotImage
          level={1}
          state="point-right"
          size={48}
          className="size-12 shrink-0 object-contain"
        />
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Tạo Flash card</h2>
          <p className="text-sm text-text-secondary">Biến nội dung của bạn thành thẻ học</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Nguồn tạo bộ">
        {SOURCE_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const active = mode === chip.mode;
          return (
            <Link
              key={chip.mode}
              href={updateSearchParamHref("/sets", searchParams, "create", chip.createValue)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "border-primary bg-primary-soft text-primary-foreground"
                  : "border-border-soft bg-surface text-text-secondary hover:bg-surface/70 hover:text-text-primary",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {chip.label}
            </Link>
          );
        })}
      </div>

      {mode !== null ? (
        <div className="mt-4 border-t border-border-soft pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text-secondary">Tạo bộ mới</span>
            <Link className="text-sm underline" href={closeHref} scroll={false}>
              Đóng
            </Link>
          </div>
          {children}
        </div>
      ) : null}
    </section>
  );
}
