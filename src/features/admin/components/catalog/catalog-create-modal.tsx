"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCatalogSetAction } from "@/features/admin/server/admin-catalog-actions";
import type { AdminCatalogCategory } from "@/features/admin/server/admin-catalog-queries";

export interface CatalogCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: AdminCatalogCategory[];
}

export function CatalogCreateModal({ isOpen, onClose, categories }: CatalogCreateModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [description, setDescription] = useState("");
  const [languageFront, setLanguageFront] = useState("vi");
  const [languageBack, setLanguageBack] = useState("en");
  const [level, setLevel] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]> | undefined>();
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // Auto-generate slug if slug is empty or matches previous auto-slug
    const autoSlug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || slug === slug.trim()) {
      setSlug(autoSlug);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors(undefined);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    startTransition(async () => {
      const result = await createCatalogSetAction({
        title,
        slug,
        category_id: categoryId,
        description: description.trim() || null,
        language_front: languageFront.trim() || "vi",
        language_back: languageBack.trim() || "en",
        level: level.trim() || null,
        tags,
      });

      if (result.success) {
        onClose();
        router.push(`/admin/catalog/${result.data.id}`);
      } else {
        setError(result.message);
        setValidationErrors(result.validationErrors);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Tạo bộ Catalog mới
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Tiêu đề bộ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="VD: 50 Từ vựng Trái cây tiếng Anh"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {validationErrors?.title && (
              <p className="mt-1 text-xs text-rose-500">{validationErrors.title[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Slug URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                placeholder="tu-vung-trai-cay"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {validationErrors?.slug && (
                <p className="mt-1 text-xs text-rose-500">{validationErrors.slug[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Danh mục <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn gọn về nội dung bộ flashcard..."
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Ngôn ngữ trước
              </label>
              <input
                type="text"
                value={languageFront}
                onChange={(e) => setLanguageFront(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Ngôn ngữ sau
              </label>
              <input
                type="text"
                value={languageBack}
                onChange={(e) => setLanguageBack(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Cấp độ
              </label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="A1, Beginner..."
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Tags (phân cách bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tieng anh, co ban, tu vung"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim() || !slug.trim()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
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
              Tạo bản thảo (Draft)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
