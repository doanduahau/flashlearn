"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { mainNavItems, secondaryNavItems } from "@/components/layout/nav-items";

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
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border-soft bg-surface md:hidden"
    >
      {[...mainNavItems, ...secondaryNavItems].map((item) => (
        <BottomNavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
