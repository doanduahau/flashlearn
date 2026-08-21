"use client";

import { useState } from "react";

import { CatalogCreateModal } from "@/features/admin/components/catalog/catalog-create-modal";
import type { AdminCatalogCategory } from "@/features/admin/server/admin-catalog-queries";

export interface CatalogListHeaderProps {
  categories: AdminCatalogCategory[];
  canWrite: boolean;
  mutationsEnabled: boolean;
}

export function CatalogListHeader({
  categories,
  canWrite,
  mutationsEnabled,
}: CatalogListHeaderProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl text-slate-900 dark:text-white">
          Quản lý thư viện Catalog
        </h1>
        <p className="text-sm text-slate-500">
          Biên tập, xuất bản, lưu trữ và quản lý bộ flashcard mẫu hệ thống.
        </p>
      </header>

      {canWrite && mutationsEnabled && (
        <div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            + Tạo bộ mới
          </button>

          <CatalogCreateModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            categories={categories}
          />
        </div>
      )}
    </div>
  );
}
