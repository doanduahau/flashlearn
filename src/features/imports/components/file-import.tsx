"use client";

import { useState } from "react";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { DocumentImport } from "@/features/imports/components/document-import";
import { ImportWizard } from "@/features/imports/components/import-wizard";
import { Label } from "@/components/ui/label";
import type { AiPlanTier } from "@/features/entitlements/ai-job-limits";

const SUPPORTED_TYPES = ".xlsx,.csv,.docx,.pdf";

function fileKind(fileName: string): "spreadsheet" | "document" {
  const extension = (fileName.split(".").pop() ?? "").toLowerCase();
  return extension === "xlsx" || extension === "csv" ? "spreadsheet" : "document";
}

export function FileImport({
  mascotLevel,
  planTier,
}: Readonly<{ mascotLevel: MascotLevel; planTier: AiPlanTier }>) {
  const [selection, setSelection] = useState<{ file: File; key: string } | null>(null);
  const [error, setError] = useState("");

  function handleFile(file: File | undefined): void {
    if (!file) return;
    setError("");
    setSelection({ file, key: crypto.randomUUID() });
  }

  if (selection) {
    return fileKind(selection.file.name) === "spreadsheet" ? (
      <ImportWizard key={selection.key} initialFile={selection.file} mascotLevel={mascotLevel} />
    ) : (
      <DocumentImport
        key={selection.key}
        initialFile={selection.file}
        mascotLevel={mascotLevel}
        planTier={planTier}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-soft p-6">
      <MascotImage
        level={mascotLevel}
        state="thinking"
        size={64}
        className="mx-auto size-16 object-contain"
      />
      <Label htmlFor="file-import-input" className="block cursor-pointer text-sm font-semibold">
        Chọn hoặc kéo tệp CSV/XLSX, Word (.docx) hoặc PDF vào đây
      </Label>
      <p className="text-sm text-text-secondary">
        Hệ thống tự nhận diện loại tệp. Tệp được xử lý tạm thời và không lưu bản gốc.
      </p>
      <input
        id="file-import-input"
        className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        type="file"
        accept={SUPPORTED_TYPES}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {error && (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
