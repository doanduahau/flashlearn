"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  mainNavItems,
  mobileOverflowNavItems,
  mobilePrimaryNavItems,
  secondaryNavItems,
} from "@/components/layout/nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-foreground"
          : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function BottomNavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
        active ? "text-primary-foreground" : "text-text-secondary",
      )}
    >
      <Icon className="size-6 shrink-0" />
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}

function MobileOverflowNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overflowActive = mobileOverflowNavItems.some((item) => isActive(pathname, item.href));
  const MoreIcon = mobilePrimaryNavItems[4].icon;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div className="relative flex flex-1">
      {isOpen ? (
        <>
          <button
            aria-label={"\u0110\u00f3ng th\u00eam \u0111i\u1ec1u h\u01b0\u1edbng"}
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] right-2 z-40 w-56 rounded-2xl border border-border-soft bg-surface p-2 shadow-soft-card">
            <p className="px-3 py-2 text-sm font-semibold text-text-secondary">{"Th\u00eam"}</p>
            {mobileOverflowNavItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-primary-soft text-primary-foreground"
                      : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        aria-label={"Th\u00eam \u0111i\u1ec1u h\u01b0\u1edbng"}
        aria-expanded={isOpen}
        aria-current={overflowActive ? "page" : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          overflowActive ? "text-primary-foreground" : "text-text-secondary",
        )}
      >
        <MoreIcon className="size-6" aria-hidden="true" />
        <span>{"Th\u00eam"}</span>
      </button>
    </div>
  );
}

export function AppNavigation({ variant }: { variant: "sidebar" | "bottom" }) {
  if (variant === "sidebar") {
    return (
      <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {mainNavItems.map((item) => (
            <SidebarLink key={item.href} {...item} />
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-border-soft pt-4">
          {secondaryNavItems.map((item) => (
            <SidebarLink key={item.href} {...item} />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border-soft bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobilePrimaryNavItems.slice(0, 4).map((item) => (
        <BottomNavLink key={item.href} {...item} />
      ))}
      <MobileOverflowNavigation />
    </nav>
  );
}
