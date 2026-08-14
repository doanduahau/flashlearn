import { ClipboardPaste, FileText, Sheet, SquarePen } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type CreateSource = "paste" | "google_sheets" | "file" | "manual";

const SOURCE_CHIPS: Array<{
  source: CreateSource;
  label: string;
  icon: typeof ClipboardPaste;
}> = [
  { source: "paste", label: "Dán nội dung", icon: ClipboardPaste },
  { source: "google_sheets", label: "Google Sheets", icon: Sheet },
  { source: "file", label: "Tài liệu", icon: FileText },
  { source: "manual", label: "Thủ công", icon: SquarePen },
];

export function createSourceHref(source: CreateSource): string {
  return source === "paste" ? "/sets/create" : `/sets/create?source=${source}`;
}

export function CreateSourceChips({ current }: Readonly<{ current: CreateSource }>) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Nguồn tạo bộ">
      {SOURCE_CHIPS.map((chip) => {
        const Icon = chip.icon;
        const active = current === chip.source;
        return (
          <Link
            key={chip.source}
            href={createSourceHref(chip.source)}
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
  );
}
