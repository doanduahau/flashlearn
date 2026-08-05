"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCard } from "@/features/flashcard-sets/server/actions";
import { CARD_TEXT_MAX_LENGTH } from "@/lib/constants";

export function AddCardForm({ setId }: Readonly<{ setId: string }>) {
  const router = useRouter();
  const frontId = useId();
  const backId = useId();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(): void {
    setError("");
    startTransition(async () => {
      const result = await addCard({ setId, front, back });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFront("");
      setBack("");
      router.refresh();
    });
  }

  return (
    <form
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
      <Button type="submit" className="mt-3" disabled={isPending || !front.trim() || !back.trim()}>
        {isPending ? "Đang thêm…" : "Thêm thẻ"}
      </Button>
    </form>
  );
}
