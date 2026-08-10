"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { analyzePasteContent } from "@/features/imports/server/analyze-paste";
import { importFlashcards } from "@/features/imports/server/actions";
import { IMPORT_PREVIEW_ROWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{
    valid: number;
    blank: number;
    partial: number;
    duplicate: number;
    rows: Array<{ front: string; back: string; sourceRow?: number }>;
  } | null>(null);
  const [error, setError] = useState("");

  const isPending = analyzing || importing;

  async function handleAnalyze(): Promise<void> {
    setError("");
    setAnalyzing(true);
    try {
      const result = await analyzePasteContent(text);
      if ("error" in result) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setPreview({
        valid: result.valid,
        blank: result.blank,
        partial: result.partial,
        duplicate: result.duplicate,
        rows: result.cards,
      });
    } catch {
      setError("Không thể phân tích nội dung. Vui lòng thử lại.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!preview || preview.rows.length === 0) {
      setError("Chưa có thẻ nào để import.");
      return;
    }
    setError("");
    setImporting(true);
    try {
      const result = await importFlashcards({ name, cards: preview.rows });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/sets/${result.setId}`);
    } catch {
      setError("Không thể tạo bộ. Vui lòng thử lại.");
    } finally {
      setImporting(false);
    }
  }

  const canSubmit = preview && preview.rows.length > 0 && name.trim().length > 0;

  const previewRows = preview ? preview.rows.slice(0, IMPORT_PREVIEW_ROWS) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="paste-textarea">Dán nội dung</Label>
        <textarea
          id="paste-textarea"
          className="min-h-32 w-full rounded-xl border border-border-soft bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none sm:min-h-40 sm:text-base"
          placeholder="Dán nội dung học tập vào đây..."
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setError("");
          }}
          disabled={isPending}
        />
      </div>

      <Button onClick={handleAnalyze} disabled={isPending}>
        {analyzing ? "Đang phân tích..." : "Phân tích"}
      </Button>

      {preview && (
        <div className="flex flex-col gap-4 rounded-xl border border-border-soft bg-surface-subtle p-3 sm:rounded-2xl sm:p-5">
          <div className="flex flex-wrap gap-2 text-sm text-text-secondary">
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-foreground">
              {preview.valid} thẻ hợp lệ
            </span>
            {preview.blank > 0 && (
              <span className="rounded-full bg-surface px-3 py-1 text-xs">
                {preview.blank} dòng trống
              </span>
            )}
            {preview.partial > 0 && (
              <span className="rounded-full bg-surface px-3 py-1 text-xs">
                {preview.partial} thiếu dữ liệu
              </span>
            )}
            {preview.duplicate > 0 && (
              <span className="rounded-full bg-surface px-3 py-1 text-xs">
                {preview.duplicate} trùng
              </span>
            )}
          </div>

          {previewRows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-xl border border-border-soft bg-surface sm:max-h-80">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface-subtle">
                  <tr className="text-xs text-text-secondary">
                    <th className="px-3 py-2 font-medium sm:px-4">Mặt trước</th>
                    <th className="px-3 py-2 font-medium sm:px-4">Mặt sau</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((card, i) => (
                    <tr key={i} className="border-t border-border-soft">
                      <td className="px-3 py-2 sm:px-4">{card.front}</td>
                      <td className="px-3 py-2 sm:px-4">{card.back}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > IMPORT_PREVIEW_ROWS && (
                <p className="px-3 py-2 text-xs text-text-secondary">
                  Hiển thị {IMPORT_PREVIEW_ROWS} / {preview.rows.length} thẻ
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="paste-set-name">Tên bộ</Label>
            <Input
              id="paste-set-name"
              placeholder="Nhập tên bộ flashcard"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {importing ? "Đang import..." : "Tạo bộ"}
          </Button>
        </div>
      )}

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
