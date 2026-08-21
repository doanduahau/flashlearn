"use client";

import { useState, useTransition } from "react";

import { updateCatalogMetadataAction } from "@/features/admin/server/admin-catalog-actions";
import type {
  AdminCatalogCategory,
  AdminCatalogSetDetail,
} from "@/features/admin/server/admin-catalog-queries";

export interface CatalogMetadataFormProps {
  catalogSet: AdminCatalogSetDetail;
  categories: AdminCatalogCategory[];
  mutationsEnabled: boolean;
}

export function CatalogMetadataForm({
  catalogSet,
  categories,
  mutationsEnabled,
}: CatalogMetadataFormProps) {
  const [title, setTitle] = useState(catalogSet.title);
  const [slug, setSlug] = useState(catalogSet.slug);
  const [categoryId, setCategoryId] = useState(catalogSet.categoryId);
  const [description, setDescription] = useState(catalogSet.description || "");
  const [languageFront, setLanguageFront] = useState(catalogSet.languageFront);
  const [languageBack, setLanguageBack] = useState(catalogSet.languageBack);
  const [level, setLevel] = useState(catalogSet.level || "");
  const [tagsInput, setTagsInput] = useState((catalogSet.tags || []).join(", "));
  const [updatedAt, setUpdatedAt] = useState(catalogSet.updatedAt);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDraft = catalogSet.status === "draft";
  const isSlugEditable = isDraft && catalogSet.publishedRevisionCount === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    startTransition(async () => {
      const result = await updateCatalogMetadataAction({
        catalog_set_id: catalogSet.id,
        expected_updated_at: updatedAt,
        title,
        description: description.trim() || null,
        category_id: categoryId,
        language_front: languageFront.trim() || "vi",
        language_back: languageBack.trim() || "en",
        level: level.trim() || null,
        tags,
        slug: isSlugEditable ? slug : null,
      });

      if (result.success) {
        setSuccessMsg("Cập nhật thông tin thành công.");
        setUpdatedAt(result.data.updatedAt);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h4 className="text-base font-semibold text-slate-900 dark:text-white">
        Thông tin & Metadata bộ Catalog
      </h4>
      <p className="mt-1 text-xs text-slate-500">
        {isDraft
          ? "Chỉnh sửa các trường thông tin của bản thảo. Lưu ý: Thay đổi chỉ có hiệu lực khi lưu."
          : "Bộ thẻ đang ở trạng thái phát hành/lưu trữ (bất biến). Hãy gỡ xuất bản về Bản thảo (Draft) để chỉnh sửa."}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400">
          <div className="font-semibold">Không thể lưu:</div>
          <div>{error}</div>
          {error.includes("P0004") || error.includes("làm mới") ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-semibold underline"
            >
              Tải lại trang ngay
            </button>
          ) : null}
        </div>
      )}

      {successMsg && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Tiêu đề bộ <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={120}
            disabled={!isDraft || !mutationsEnabled || isPending}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Slug URL{" "}
              {isSlugEditable ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="text-xs text-slate-400">(Khóa bất biến)</span>
              )}
            </label>
            <input
              type="text"
              required
              disabled={!isSlugEditable || !mutationsEnabled || isPending}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Danh mục <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={!isDraft || !mutationsEnabled || isPending}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Mô tả
          </label>
          <textarea
            rows={3}
            maxLength={500}
            disabled={!isDraft || !mutationsEnabled || isPending}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Ngôn ngữ trước
            </label>
            <input
              type="text"
              disabled={!isDraft || !mutationsEnabled || isPending}
              value={languageFront}
              onChange={(e) => setLanguageFront(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Ngôn ngữ sau
            </label>
            <input
              type="text"
              disabled={!isDraft || !mutationsEnabled || isPending}
              value={languageBack}
              onChange={(e) => setLanguageBack(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Cấp độ
            </label>
            <input
              type="text"
              disabled={!isDraft || !mutationsEnabled || isPending}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Tags
          </label>
          <input
            type="text"
            disabled={!isDraft || !mutationsEnabled || isPending}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
          />
        </div>

        {isDraft && mutationsEnabled && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Lưu thông tin Metadata
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
