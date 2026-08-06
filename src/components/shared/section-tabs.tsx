import Link from "next/link";

import { cn } from "@/lib/utils";

export function SectionTabs({
  label,
  items,
  current,
}: Readonly<{
  label: string;
  current: string;
  items: { value: string; label: string; href: string }[];
}>) {
  return (
    <nav
      aria-label={label}
      className="mt-5 flex w-full gap-1 overflow-x-auto rounded-2xl bg-surface-subtle p-1"
    >
      {items.map((item) => {
        const active = item.value === current;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-surface text-primary-foreground shadow-sm"
                : "text-text-secondary hover:bg-surface/70 hover:text-text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
