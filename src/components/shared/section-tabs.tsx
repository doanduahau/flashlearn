"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionTab = { value: string; label: string; href: string };

export function SectionTabs({
  label,
  items,
  current,
  children,
  pendingContent,
}: Readonly<{
  label: string;
  current: string;
  items: SectionTab[];
  children: ReactNode;
  pendingContent: ReactNode;
}>) {
  const router = useRouter();
  const [activeValue, setActiveValue] = useOptimistic(current, (_, nextValue: string) => nextValue);
  const [isNavigating, startTransition] = useTransition();

  function navigate(event: MouseEvent<HTMLAnchorElement>, item: SectionTab): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    startTransition(() => {
      setActiveValue(item.value);
      router.push(item.href, { scroll: false });
    });
  }

  return (
    <>
      <nav
        aria-label={label}
        className="mt-2 flex w-full gap-1 overflow-x-auto rounded-2xl bg-surface-subtle p-1 sm:mt-5"
      >
        {items.map((item) => {
          const active = item.value === activeValue;
          return (
            <Link
              key={item.value}
              href={item.href}
              scroll={false}
              onClick={(event) => navigate(event, item)}
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
      <div aria-busy={isNavigating}>{isNavigating ? pendingContent : children}</div>
    </>
  );
}
