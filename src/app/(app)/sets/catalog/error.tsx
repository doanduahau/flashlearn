"use client";

import { Button } from "@/components/ui/button";

export default function CatalogError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div role="alert" className="rounded-3xl border border-danger/30 bg-surface p-6">
        <h1 className="text-xl font-bold">Không thể tải Thư viện Flashcard</h1>
        <p className="mt-2 text-text-secondary">Vui lòng kiểm tra kết nối và thử lại.</p>
        <Button type="button" className="mt-4 min-h-11" onClick={reset}>
          Thử lại
        </Button>
      </div>
    </main>
  );
}
