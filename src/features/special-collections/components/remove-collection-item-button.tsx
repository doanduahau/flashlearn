"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { removeCollectionItem } from "@/features/special-collections/server/actions";

export function RemoveCollectionItemButton({
  collectionId,
  cardId,
}: Readonly<{ collectionId: string; cardId: string }>) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm(): void {
    setError("");
    startTransition(async () => {
      const result = await removeCollectionItem({ collectionId, cardId });
      if (!result.ok) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (!isConfirming) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="ghost" onClick={() => setIsConfirming(true)}>
          Bỏ thẻ
        </Button>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border-soft bg-surface-subtle p-4">
        <p className="font-medium">Bỏ thẻ này khỏi bộ đặc biệt?</p>
        <p className="mt-1 text-sm text-text-secondary">Thẻ gốc trong bộ flashcard không bị xóa.</p>
        {error ? (
          <p role="alert" className="mt-2 text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="destructive" disabled={isPending} onClick={confirm}>
            {isPending ? "Đang bỏ…" : "Bỏ thẻ"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setIsConfirming(false);
              setError("");
            }}
          >
            Hủy
          </Button>
        </div>
      </div>
    </div>
  );
}
