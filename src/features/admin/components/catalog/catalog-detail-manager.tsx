"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CatalogActionDialog } from "@/features/admin/components/catalog/catalog-action-dialog";
import { CatalogCardEditor } from "@/features/admin/components/catalog/catalog-card-editor";
import { CatalogMetadataForm } from "@/features/admin/components/catalog/catalog-metadata-form";
import { CatalogPreviewTab } from "@/features/admin/components/catalog/catalog-preview-tab";
import { CatalogStarterSwapDialog } from "@/features/admin/components/catalog/catalog-starter-swap-dialog";
import {
  archiveCatalogSetAction,
  publishCatalogSetAction,
  restoreCatalogSetAction,
  unpublishCatalogSetAction,
} from "@/features/admin/server/admin-catalog-actions";
import type {
  AdminCatalogCategory,
  AdminCatalogSetDetail,
} from "@/features/admin/server/admin-catalog-queries";

export interface CatalogDetailManagerProps {
  catalogSet: AdminCatalogSetDetail;
  categories: AdminCatalogCategory[];
  activeStarters: Array<{
    id: string;
    title: string;
    slug: string;
    starterOrder: number;
    updatedAt: string;
  }>;
  canWrite: boolean;
  canPublish: boolean;
  mutationsEnabled: boolean;
}

export function CatalogDetailManager({
  catalogSet,
  categories,
  activeStarters,
  canWrite,
  canPublish,
  mutationsEnabled,
}: CatalogDetailManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"metadata" | "cards" | "preview">("metadata");
  const [dialogState, setDialogState] = useState<
    "publish" | "unpublish" | "archive" | "restore" | "swap_starter" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDraft = catalogSet.status === "draft";
  const isPublished = catalogSet.status === "published";
  const isArchived = catalogSet.status === "archived";

  const handlePublish = async (reason: string) => {
    setActionError(null);
    const res = await publishCatalogSetAction({
      catalog_set_id: catalogSet.id,
      expected_updated_at: catalogSet.updatedAt,
      reason,
    });
    if (res.success) {
      router.refresh();
      return { success: true };
    }
    setActionError(res.message);
    return { success: false, message: res.message };
  };

  const handleUnpublish = async (reason: string) => {
    setActionError(null);
    const res = await unpublishCatalogSetAction({
      catalog_set_id: catalogSet.id,
      expected_updated_at: catalogSet.updatedAt,
      reason,
    });
    if (res.success) {
      router.refresh();
      return { success: true };
    }
    setActionError(res.message);
    return { success: false, message: res.message };
  };

  const handleArchive = async (reason: string) => {
    setActionError(null);
    const res = await archiveCatalogSetAction({
      catalog_set_id: catalogSet.id,
      expected_updated_at: catalogSet.updatedAt,
      reason,
    });
    if (res.success) {
      router.refresh();
      return { success: true };
    }
    setActionError(res.message);
    return { success: false, message: res.message };
  };

  const handleRestore = async (reason: string) => {
    setActionError(null);
    const res = await restoreCatalogSetAction({
      catalog_set_id: catalogSet.id,
      expected_updated_at: catalogSet.updatedAt,
      reason,
    });
    if (res.success) {
      router.refresh();
      return { success: true };
    }
    setActionError(res.message);
    return { success: false, message: res.message };
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin/catalog" className="hover:text-slate-800 dark:hover:text-slate-200">
            ← Danh sách Catalog
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">{catalogSet.title}</span>
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{catalogSet.title}</h2>

            {/* Status Badge */}
            {isDraft && (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                Bản thảo (Draft)
              </span>
            )}
            {isPublished && (
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                Đã xuất bản (v{catalogSet.version})
              </span>
            )}
            {isArchived && (
              <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                Đã lưu trữ
              </span>
            )}
            {catalogSet.isStarter && (
              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                Starter #{catalogSet.starterOrder}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          {canPublish && mutationsEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              {isDraft && (
                <>
                  {activeStarters.length > 0 && canWrite && (
                    <button
                      type="button"
                      onClick={() => setDialogState("swap_starter")}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300"
                    >
                      Thay thế Starter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDialogState("publish")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                  >
                    Xuất bản (Publish)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogState("archive")}
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    Lưu trữ
                  </button>
                </>
              )}

              {isPublished && (
                <>
                  <button
                    type="button"
                    onClick={() => setDialogState("unpublish")}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    Gỡ xuất bản (Unpublish)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogState("archive")}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400"
                  >
                    Lưu trữ (Archive)
                  </button>
                </>
              )}

              {isArchived && (
                <button
                  type="button"
                  onClick={() => setDialogState("restore")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                >
                  Khôi phục về Bản thảo (Restore)
                </button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400">
            {actionError}
          </div>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("metadata")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "metadata"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Thông tin & Metadata
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cards")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "cards"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Quản lý Thẻ ({catalogSet.cardCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "preview"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Xem trước (Preview)
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "metadata" && (
        <CatalogMetadataForm
          catalogSet={catalogSet}
          categories={categories}
          mutationsEnabled={mutationsEnabled && canWrite}
        />
      )}

      {activeTab === "cards" && (
        <CatalogCardEditor
          catalogSet={catalogSet}
          mutationsEnabled={mutationsEnabled && canWrite}
        />
      )}

      {activeTab === "preview" && <CatalogPreviewTab catalogSet={catalogSet} />}

      {/* Confirmation Dialogs */}
      <CatalogActionDialog
        isOpen={dialogState === "publish"}
        onClose={() => setDialogState(null)}
        title="Xác nhận Xuất bản (Publish)"
        description={`Bạn sắp phát hành chính thức bộ "${catalogSet.title}" (gồm ${catalogSet.cardCount} thẻ). Người dùng trên toàn hệ thống sẽ có thể xem và cài đặt bộ thẻ này.`}
        actionLabel="Xác nhận Xuất bản"
        actionVariant="primary"
        onConfirm={handlePublish}
      />

      <CatalogActionDialog
        isOpen={dialogState === "unpublish"}
        onClose={() => setDialogState(null)}
        title="Xác nhận Gỡ xuất bản (Unpublish)"
        description={`Bộ thẻ "${catalogSet.title}" sẽ được thu hồi về trạng thái Bản thảo (Draft) để chỉnh sửa. Người dùng chưa cài đặt sẽ không còn thấy bộ thẻ này trong thư viện.`}
        actionLabel="Gỡ xuất bản"
        actionVariant="warning"
        onConfirm={handleUnpublish}
      />

      <CatalogActionDialog
        isOpen={dialogState === "archive"}
        onClose={() => setDialogState(null)}
        title="Xác nhận Lưu trữ (Archive)"
        description={`Bộ thẻ "${catalogSet.title}" sẽ được đưa vào lưu trữ và ẩn khỏi thư viện. Các bản clone của người dùng đã cài từ trước vẫn được giữ nguyên.`}
        actionLabel="Lưu trữ"
        actionVariant="danger"
        onConfirm={handleArchive}
      />

      <CatalogActionDialog
        isOpen={dialogState === "restore"}
        onClose={() => setDialogState(null)}
        title="Xác nhận Khôi phục (Restore)"
        description={`Khôi phục bộ thẻ "${catalogSet.title}" từ kho lưu trữ về trạng thái Bản thảo (Draft) để tiếp tục quản lý.`}
        actionLabel="Khôi phục về Draft"
        actionVariant="primary"
        onConfirm={handleRestore}
      />

      <CatalogStarterSwapDialog
        isOpen={dialogState === "swap_starter"}
        onClose={() => setDialogState(null)}
        currentDraftSet={catalogSet}
        activeStarters={activeStarters}
      />
    </div>
  );
}
