"use client";

import { Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import type {
  SourceOption,
  SourcePage,
  SourceType,
} from "@/features/source-selection/types/source-types";
import { cn } from "@/lib/utils";

const filterOptions: { value: SourceType; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "regular", label: "Bộ thường" },
  { value: "special", label: "Bộ đặc biệt" },
];

export function SourceBrowser({
  path,
  sourcePage,
  selected,
  onToggle,
  allCount,
  allSelected,
  onSelectAll,
  mascotLevel,
}: Readonly<{
  path: string;
  sourcePage: SourcePage;
  selected: SourceOption[];
  onToggle: (source: SourceOption) => void;
  allCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  mascotLevel: MascotLevel;
}>) {
  const router = useRouter();
  const [query, setQuery] = useState(sourcePage.query);
  const [pendingType, setPendingType] = useState<SourceType | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const selectedKeys = new Set(selected.map((source) => `${source.kind}:${source.id}`));
  const activeType = isNavigating && pendingType ? pendingType : sourcePage.type;

  function navigate(changes: Record<string, string | undefined>): void {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (changes.page) params.set("page", changes.page);
    const search = params.toString();
    if (changes.sourceType) setPendingType(changes.sourceType as SourceType);
    startTransition(() => router.replace(search ? `${path}?${search}` : path, { scroll: false }));
  }

  function submitSearch(): void {
    navigate({ q: query.trim() || undefined });
  }

  return (
    <section className="space-y-2 sm:space-y-3" aria-labelledby="source-browser-heading">
      <h2 id="source-browser-heading" className="text-base font-semibold sm:text-lg">
        Chọn một hoặc nhiều nguồn
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <label className="sr-only" htmlFor="source-search">
          Tìm nguồn theo tên
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <input
            id="source-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bộ theo tên"
            className="h-11 w-full rounded-xl border border-border-soft bg-surface py-2 pl-9 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <Button type="submit" variant="outline" disabled={isNavigating}>
          Tìm
        </Button>
      </form>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc loại nguồn" role="group">
        {filterOptions.map((filter) => (
          <Button
            type="button"
            size="sm"
            key={filter.value}
            variant={activeType === filter.value ? "soft" : "outline"}
            aria-pressed={activeType === filter.value}
            onClick={() => navigate({ sourceType: filter.value, q: sourcePage.query || undefined })}
            disabled={isNavigating}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      {selected.length ? (
        <div
          aria-label="Nguồn đã chọn"
          className="flex flex-wrap gap-2 rounded-2xl bg-primary-soft p-3"
        >
          {selected.map((source) => (
            <Button
              type="button"
              key={`${source.kind}:${source.id}`}
              size="sm"
              variant="outline"
              onClick={() => onToggle(source)}
              title={`Bỏ chọn ${source.name}`}
              aria-label={`Bỏ chọn ${source.name}`}
            >
              <span className="max-w-36 truncate">{source.name}</span>
              <X aria-hidden="true" />
            </Button>
          ))}
        </div>
      ) : null}
      {isNavigating ? <SourceSkeleton /> : null}
      <ul className={cn("grid gap-2", isNavigating && "opacity-50")} aria-live="polite">
        <li>
          <label className="flex min-h-10 items-center gap-3 rounded-2xl border border-border-soft bg-surface p-2.5 hover:bg-surface-subtle sm:min-h-12 sm:p-3">
            <input
              type="radio"
              name="source-scope"
              checked={allSelected}
              onChange={onSelectAll}
              aria-label={`Tất cả ${allCount} thẻ`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium sm:text-base">
                Tất cả {allCount} thẻ
              </span>
              <span className="text-xs text-text-secondary">Tất cả</span>
            </span>
          </label>
        </li>
        {sourcePage.sources.map((source) => {
          const selectedSource = selectedKeys.has(`${source.kind}:${source.id}`);
          return (
            <li key={`${source.kind}:${source.id}`}>
              <label className="flex min-h-10 items-center gap-3 rounded-2xl border border-border-soft bg-surface p-2.5 hover:bg-surface-subtle sm:min-h-12 sm:p-3">
                <input
                  type="checkbox"
                  checked={selectedSource}
                  onChange={() => onToggle(source)}
                  aria-label={`${source.name}, ${source.kind === "regular" ? "Bộ thường" : "Bộ đặc biệt"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium sm:text-base">
                    {source.name}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {source.kind === "regular" ? "Bộ thường" : "Bộ đặc biệt"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-text-secondary sm:text-sm">
                  {source.cardCount} thẻ
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {!isNavigating && sourcePage.sources.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-5 text-center text-text-secondary">
          <MascotImage
            level={mascotLevel}
            state="thinking"
            size={64}
            className="mx-auto mb-2 size-16 object-contain"
          />
          Không tìm thấy nguồn phù hợp.
        </p>
      ) : null}
      {sourcePage.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Phân trang nguồn">
          <Button
            type="button"
            variant="outline"
            disabled={sourcePage.page === 1 || isNavigating}
            onClick={() => navigate({ page: String(sourcePage.page - 1) })}
          >
            Trước
          </Button>
          <span className="text-sm text-text-secondary">
            Trang {sourcePage.page} / {sourcePage.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={sourcePage.page === sourcePage.totalPages || isNavigating}
            onClick={() => navigate({ page: String(sourcePage.page + 1) })}
          >
            Sau
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

function SourceSkeleton() {
  return (
    <div aria-label="Đang tải nguồn" className="grid gap-2" role="status">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-16 animate-pulse rounded-2xl bg-surface-subtle" />
      ))}
    </div>
  );
}
