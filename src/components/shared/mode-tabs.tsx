import Link from "next/link";

import { cn } from "@/lib/utils";

export type ModeTabItem = {
  label: string;
  href: string;
  active: boolean;
};

/**
 * Top-level product-area tabs shared by Học and Kiểm tra. They are plain links
 * so the active state is derived server-side and deep links remain intact.
 */
export function ModeTabs({
  label,
  items,
}: Readonly<{
  label: string;
  items: readonly ModeTabItem[];
}>) {
  return (
    <nav
      aria-label={label}
      className="mt-2 flex w-full gap-1 overflow-x-auto rounded-2xl bg-surface-subtle p-1 sm:mt-5"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            item.active
              ? "bg-surface text-primary-foreground shadow-sm"
              : "text-text-secondary hover:bg-surface/70 hover:text-text-primary",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
