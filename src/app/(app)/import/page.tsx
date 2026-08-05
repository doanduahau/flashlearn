import type { Metadata } from "next";

import { ImportWizard } from "@/features/imports/components/import-wizard";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Import flashcard</h1>
      <p className="mt-2 text-text-secondary">Tạo một bộ flashcard từ CSV hoặc Excel.</p>
      <div className="mt-6">
        <ImportWizard />
      </div>
    </main>
  );
}
