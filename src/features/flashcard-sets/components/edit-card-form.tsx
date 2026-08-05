"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCard } from "@/features/flashcard-sets/server/actions";
import { CARD_TEXT_MAX_LENGTH } from "@/lib/constants";

export function EditCardForm({
  setId,
  cardId,
  initialFront,
  initialBack,
}: Readonly<{
  setId: string;
  cardId: string;
  initialFront: string;
  initialBack: string;
}>) {
  const router = useRouter();
  const frontId = useId();
  const backId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(): void {
    setError("");
    startTransition(async () => {
      const result = await updateCard({ setId, cardId, front, back });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="ghost" onClick={() => setIsOpen(true)}>
        Sửa
      </Button>
    );
  }

  return (
    <form
      className="rounded-2xl border border-border-soft bg-surface-subtle p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3">
        <div>
          <Label htmlFor={frontId}>Mặt trước</Label>
          <Textarea
            id={frontId}
            className="mt-1"
            value={front}
            maxLength={CARD_TEXT_MAX_LENGTH}
            onChange={(event) => setFront(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={backId}>Mặt sau</Label>
          <Textarea
            id={backId}
            className="mt-1"
            value={back}
            maxLength={CARD_TEXT_MAX_LENGTH}
            onChange={(event) => setBack(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={isPending || !front.trim() || !back.trim()}>
          {isPending ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setIsOpen(false);
            setError("");
            setFront(initialFront);
            setBack(initialBack);
          }}
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}
