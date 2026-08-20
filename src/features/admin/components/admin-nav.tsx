"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminPermission } from "@/features/admin/permission-map";

type NavItem = {
  label: string;
  href: string;
  permission: AdminPermission;
};

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Tổng quan", href: "/admin", permission: "audit.read" },
  { label: "Thư viện", href: "/admin/catalog", permission: "catalog.read" },
  { label: "Người dùng", href: "/admin/users", permission: "users.read" },
  { label: "Công việc", href: "/admin/jobs", permission: "jobs.read" },
  { label: "Kiểm toán", href: "/admin/audit", permission: "audit.read" },
] as const;

export function AdminNav({
  permissions,
  environment,
}: Readonly<{
  permissions: readonly AdminPermission[];
  environment: string;
}>) {
  const pathname = usePathname();
  const permissionSet = new Set(permissions);

  const visibleItems = NAV_ITEMS.filter((item) => permissionSet.has(item.permission));

  return (
    <nav className="flex flex-col gap-3" aria-label="Điều hướng quản trị">
      {/* Environment badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            environment === "production" ? "bg-danger/10 text-danger" : "bg-info/10 text-info"
          }`}
          role="status"
          aria-label={`Môi trường: ${environment}`}
        >
          <span
            className={`size-1.5 rounded-full ${
              environment === "production" ? "bg-danger" : "bg-info"
            }`}
            aria-hidden="true"
          />
          {environment === "production" ? "PRODUCTION" : "STAGING"}
        </span>
      </div>

      {/* Production warning banner */}
      {environment === "production" && (
        <div
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-text-secondary"
        >
          ⚠️ Đây là môi trường <strong>Production</strong>. Mọi thay đổi ảnh hưởng trực tiếp đến
          người dùng thực.
        </div>
      )}

      {/* Navigation links */}
      <ul className="flex flex-wrap gap-1">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-soft text-primary-foreground"
                    : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
