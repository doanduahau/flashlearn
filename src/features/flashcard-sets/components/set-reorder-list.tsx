"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/shared/loading-dots";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { moveSet } from "@/features/flashcard-sets/server/actions";

export type ReorderableSet = {
  id: string;
  name: string;
  cardCount: number;
};

export function SetReorderList({
  initialSets,
  doneHref,
  mascotLevel,
}: Readonly<{
  initialSets: ReorderableSet[];
  doneHref: string;
  mascotLevel: MascotLevel;
}>) {
  const [sets, setSets] = useState(initialSets);
  const [error, setError] = useState("");
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function move(index: number, direction: "up" | "down"): void {
    if (isPending || pendingSetId) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const set = sets[index];
    if (!set || !sets[targetIndex]) return;

    const previousSets = sets;
    const nextSets = [...sets];
    [nextSets[index], nextSets[targetIndex]] = [nextSets[targetIndex], nextSets[index]];
    setError("");
    setSets(nextSets);
    setPendingSetId(set.id);

    startTransition(async () => {
      const result = await moveSet({ setId: set.id, direction });
      if (!result.ok) {
        setSets(previousSets);
        setError(result.error);
      }
      setPendingSetId(null);
    });
  }

  return (
    <section className="mt-6" aria-labelledby="set-reorder-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="set-reorder-heading" className="text-xl font-bold">
            Sắp xếp bộ flashcard
          </h2>
          <p className="mt-1 text-text-secondary">
            Dùng nút lên hoặc xuống để thay đổi thứ tự. Mỗi thay đổi được lưu ngay.
          </p>
        </div>
        <Button asChild className="min-h-11 shrink-0">
          <Link href={doneHref} scroll={false}>
            <Check aria-hidden="true" />
            Xong
          </Link>
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-4 text-sm text-text-secondary">
        {isPending ? <LoadingDots label="Đang lưu thứ tự" /> : "Thứ tự đã được lưu."}
      </p>

      <ol aria-label="Thứ tự bộ flashcard" className="mt-4 grid gap-3">
        {sets.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border-soft bg-surface p-4 text-text-secondary">
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={64}
              className="mb-2 size-16 object-contain"
            />
            Chưa có bộ flashcard để sắp xếp.
          </li>
        ) : null}
        {sets.map((set, index) => (
          <li
            key={set.id}
            className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-4 transition-shadow hover:shadow-soft-card-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{set.name}</span>
              <span className="mt-1 block text-sm text-text-secondary">
                {set.cardCount} flashcard
              </span>
            </span>
            <span className="flex shrink-0 gap-1" aria-label={`Di chuyển ${set.name}`}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                disabled={index === 0 || isPending || Boolean(pendingSetId)}
                aria-label={`Đưa ${set.name} lên`}
                onClick={() => move(index, "up")}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                disabled={index === sets.length - 1 || isPending || Boolean(pendingSetId)}
                aria-label={`Đưa ${set.name} xuống`}
                onClick={() => move(index, "down")}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
