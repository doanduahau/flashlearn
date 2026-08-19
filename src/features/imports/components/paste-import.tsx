"use client";

import { useState } from "react";

import { analyzePasteContent } from "@/features/imports/server/analyze-paste";
import { CreateSummary } from "@/features/imports/components/create-summary";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PasteImport({ mascotLevel }: Readonly<{ mascotLevel: MascotLevel }>) {
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<{
    cards: Array<{ front: string; back: string; sourceRow?: number }>;
    aiUsed: boolean;
  } | null>(null);
  const [error, setError] = useState("");

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
      setPreview({ cards: result.cards, aiUsed: result.aiUsed });
    } catch {
      setError("Không thể phân tích nội dung. Vui lòng thử lại.");
    } finally {
      setAnalyzing(false);
    }
  }

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
          disabled={analyzing}
        />
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={analyzing}
        className={analyzing ? "h-auto py-2" : undefined}
      >
        {analyzing ? (
          <>
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={64}
              className="size-16 object-contain"
            />
            Đang phân tích...
          </>
        ) : (
          "Phân tích"
        )}
      </Button>

      {preview && (
        <CreateSummary
          key={`paste-${preview.cards.length}-${preview.aiUsed}`}
          source={preview.aiUsed ? "paste_prose" : "paste_structured"}
          sourceChars={text.trim().length}
          aiUsed={preview.aiUsed}
          sourceCards={preview.cards}
          sourceMetadata={[{ label: "Nguồn", value: "Dán nội dung" }]}
          mascotLevel={mascotLevel}
        />
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
