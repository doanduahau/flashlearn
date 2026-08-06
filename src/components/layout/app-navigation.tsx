"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mainNavItems, mobilePrimaryNavItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string, activePaths?: string[]): boolean {
  return (activePaths ?? [href]).some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  activePaths,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activePaths?: string[];
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href, activePaths);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-foreground"
          : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

function BottomNavLink({
  href,
  label,
  icon: Icon,
  activePaths,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activePaths?: string[];
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href, activePaths);

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
        active ? "text-primary-foreground" : "text-text-secondary",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="max-w-full truncate px-0.5">{label}</span>
    </Link>
  );
}

export function AppNavigation({ variant }: Readonly<{ variant: "sidebar" | "bottom" }>) {
  if (variant === "sidebar") {
    return (
      <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <SidebarLink key={item.href} {...item} />
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border-soft bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobilePrimaryNavItems.map((item) => (
        <BottomNavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
