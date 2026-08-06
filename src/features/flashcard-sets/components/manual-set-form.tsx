"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importFlashcards } from "@/features/imports/server/actions";
import { CARD_TEXT_MAX_LENGTH, SET_NAME_MAX_LENGTH } from "@/lib/constants";

export function ManualSetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(): void {
    setError("");
    startTransition(async () => {
      const result = await importFlashcards({ name, cards: [{ front, back }] });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/sets/${result.setId}`);
    });
  }

  return (
    <form
      className="mt-5 space-y-4 rounded-2xl border border-border-soft bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="font-semibold">Tạo bộ thủ công</h2>
      <p className="text-sm text-text-secondary">
        Bắt đầu bằng tên bộ và flashcard đầu tiên của bạn.
      </p>
      <div>
        <Label htmlFor="manual-set-name">Tên bộ flashcard</Label>
        <Input
          id="manual-set-name"
          className="mt-1"
          value={name}
          maxLength={SET_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="manual-front">Mặt trước</Label>
        <Textarea
          id="manual-front"
          className="mt-1"
          value={front}
          maxLength={CARD_TEXT_MAX_LENGTH}
          onChange={(event) => setFront(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="manual-back">Mặt sau</Label>
        <Textarea
          id="manual-back"
          className="mt-1"
          value={back}
          maxLength={CARD_TEXT_MAX_LENGTH}
          onChange={(event) => setBack(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !name.trim() || !front.trim() || !back.trim()}>
        {pending ? "Đang tạo…" : "Tạo bộ"}
      </Button>
    </form>
  );
}
