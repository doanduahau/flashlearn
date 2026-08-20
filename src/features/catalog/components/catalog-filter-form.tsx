import { Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type FilterOption = { value: string; label: string };

export function CatalogFilterForm({
  query,
  category,
  language,
  level,
  categories,
}: Readonly<{
  query: string;
  category: string;
  language: string;
  level: string;
  categories: FilterOption[];
}>) {
  return (
    <form
      method="get"
      className="mt-5 grid gap-3 rounded-2xl border border-border-soft bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="relative sm:col-span-2">
        <span className="sr-only">Tìm trong thư viện Flashcard</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          name="q"
          defaultValue={query}
          placeholder="Tìm tên bộ"
          className="h-11 w-full rounded-xl border border-border-soft bg-background py-2 pl-9 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </label>
      <label>
        <span className="sr-only">Danh mục</span>
        <select
          name="category"
          defaultValue={category}
          className="h-11 w-full rounded-xl border border-border-soft bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Mọi danh mục</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Ngôn ngữ</span>
        <select
          name="language"
          defaultValue={language}
          className="h-11 w-full rounded-xl border border-border-soft bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Mọi ngôn ngữ</option>
          <option value="vi-en">Việt → Anh</option>
          <option value="vi-vi">Việt → Việt</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Trình độ</span>
        <select
          name="level"
          defaultValue={level}
          className="h-11 w-full rounded-xl border border-border-soft bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Mọi trình độ</option>
          <option value="beginner">Cơ bản</option>
          <option value="intermediate">Trung cấp</option>
          <option value="advanced">Nâng cao</option>
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
        <Button type="submit" className="min-h-11">
          Áp dụng
        </Button>
        <Button asChild type="button" variant="ghost" className="min-h-11">
          <Link href="/sets/catalog">Xóa lọc</Link>
        </Button>
      </div>
    </form>
  );
}
