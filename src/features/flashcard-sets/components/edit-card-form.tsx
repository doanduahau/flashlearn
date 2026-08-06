"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
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

  function close(): void {
    setIsOpen(false);
    setError("");
    setFront(initialFront);
    setBack(initialBack);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className="size-11 p-0 sm:h-10 sm:w-auto sm:px-4"
        onClick={() => setIsOpen(true)}
        aria-label="Sửa thẻ"
        title="Sửa thẻ"
      >
        <Pencil aria-hidden="true" />
        <span className="hidden sm:inline">Sửa</span>
      </Button>
      {isOpen ? (
        <DialogOverlay title="Sửa flashcard" onClose={isPending ? () => undefined : close}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <h2 className="text-xl font-bold">Sửa flashcard</h2>
            <div className="mt-4 grid gap-3">
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending || !front.trim() || !back.trim()}>
                {isPending ? "Đang lưu…" : "Lưu"}
              </Button>
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Hủy
              </Button>
            </div>
          </form>
        </DialogOverlay>
      ) : null}
    </>
  );
}
