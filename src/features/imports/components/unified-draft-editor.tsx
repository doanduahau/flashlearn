"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { importFlashcards } from "@/features/imports/server/actions";
import { CARD_TEXT_MAX_LENGTH, IMPORT_MAX_ROWS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditableDraftCard = {
  id: string;
  front: string;
  back: string;
};

export type SourceMetadata = {
  label?: string;
  value?: string;
};

type Props = {
  sourceCards: DraftFlashcard[];
  setCardCount?: number;
  sourceMetadata?: SourceMetadata[];
  onImport?: (
    name: string,
    cards: DraftFlashcard[],
  ) => Promise<{ setId: string } | { error: string }>;
  warnings?: string[];
  limitExceeded?: boolean;
  children?: React.ReactNode;
};

function stableId(): string {
  return crypto.randomUUID();
}

function isCardValid(card: EditableDraftCard): boolean {
  const front = card.front.trim();
  const back = card.back.trim();
  if (!front || !back) return false;
  if (front.length > CARD_TEXT_MAX_LENGTH || back.length > CARD_TEXT_MAX_LENGTH) return false;
  return true;
}

function toDraftCard(e: EditableDraftCard): DraftFlashcard {
  return { front: e.front.trim(), back: e.back.trim() };
}

function SortableCard({
  card,
  index,
  onChange,
  onDelete,
  onSwap,
}: {
  card: EditableDraftCard;
  index: number;
  onChange: (id: string, field: "front" | "back", value: string) => void;
  onDelete: (id: string) => void;
  onSwap: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const frontValid = card.front.trim().length > 0 && card.front.length <= CARD_TEXT_MAX_LENGTH;
  const backValid = card.back.trim().length > 0 && card.back.length <= CARD_TEXT_MAX_LENGTH;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 rounded-xl border border-border-soft bg-surface p-3 sm:flex-row sm:items-center sm:gap-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-manipulation self-center p-2 text-text-secondary sm:p-1"
        aria-label={`Di chuyển thẻ ${index + 1}`}
        title="Kéo để sắp xếp"
      >
        ⠿
      </button>

      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="flex-1">
          <Label htmlFor={`front-${card.id}`} className="sr-only">
            Mặt trước
          </Label>
          <textarea
            id={`front-${card.id}`}
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none sm:text-base ${
              frontValid ? "border-border-soft bg-surface" : "border-danger/40 bg-danger/5"
            }`}
            placeholder="Mặt trước"
            rows={2}
            value={card.front}
            onChange={(e) => onChange(card.id, "front", e.target.value)}
            maxLength={CARD_TEXT_MAX_LENGTH + 100}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor={`back-${card.id}`} className="sr-only">
            Mặt sau
          </Label>
          <textarea
            id={`back-${card.id}`}
            className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none sm:text-base ${
              backValid ? "border-border-soft bg-surface" : "border-danger/40 bg-danger/5"
            }`}
            placeholder="Mặt sau"
            rows={2}
            value={card.back}
            onChange={(e) => onChange(card.id, "back", e.target.value)}
            maxLength={CARD_TEXT_MAX_LENGTH + 100}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSwap(card.id)}
          disabled={isDragging}
          aria-label={`Đảo mặt trước và mặt sau của thẻ ${index + 1}`}
        >
          ⇆
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(card.id)}
          disabled={isDragging}
          aria-label={`Xóa thẻ ${index + 1}`}
          className="text-danger hover:bg-danger/10"
        >
          ✕
        </Button>
      </div>
    </div>
  );
}

export function UnifiedDraftEditor({
  sourceCards,
  setCardCount,
  sourceMetadata,
  onImport,
  warnings,
  limitExceeded,
  children,
}: Props) {
  const router = useRouter();
  const initialCards = useMemo(
    () =>
      sourceCards.map((card) => ({
        id: stableId(),
        front: card.front,
        back: card.back,
      })),
    [],
  );

  const [cards, setCards] = useState<EditableDraftCard[]>(initialCards);
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);
  const importInFlightRef = useRef(false);
  const [error, setError] = useState("");

  const canAdd = cards.length < IMPORT_MAX_ROWS;

  const invalidCards = useMemo(() => cards.filter((c) => !isCardValid(c)).length, [cards]);

  const hasValidCards = cards.some((c) => isCardValid(c));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCards((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = [...prev];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed!);
      return next;
    });
  }, []);

  function updateCard(id: string, field: "front" | "back", value: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function addCard() {
    if (!canAdd) return;
    setCards((prev) => [...prev, { id: stableId(), front: "", back: "" }]);
  }

  function swapOne(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, front: c.back, back: c.front } : c)));
  }

  function swapAll() {
    setCards((prev) => prev.map((c) => ({ ...c, front: c.back, back: c.front })));
  }

  async function handleImport() {
    if (!hasValidCards || importInFlightRef.current) return;
    importInFlightRef.current = true;
    setError("");
    setImporting(true);
    try {
      const draftCards = cards.map(toDraftCard);
      const result = await (onImport
        ? onImport(name, draftCards)
        : importFlashcards({ name, cards: draftCards }));
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/sets/${result.setId}`);
      }
    } catch {
      setError("Không thể tạo bộ. Vui lòng thử lại.");
    } finally {
      importInFlightRef.current = false;
      setImporting(false);
    }
  }

  const canImport =
    !limitExceeded && hasValidCards && name.trim().length > 0 && invalidCards === 0 && !importing;

  return (
    <div className="flex flex-col gap-4">
      {/* Source metadata (optional) */}
      {sourceMetadata && sourceMetadata.length > 0 && (
        <div className="flex flex-col text-sm">
          {sourceMetadata.map((meta, i) => (
            <div key={i} className="flex gap-2">
              {meta.label && <span className="text-text-secondary">{meta.label}:</span>}
              <span className="font-medium">{meta.value}</span>
            </div>
          ))}
          {setCardCount !== undefined && (
            <span className="text-text-secondary">
              {cards.length} / {setCardCount ?? cards.length} thẻ (
              {invalidCards > 0 ? `${invalidCards} chưa hợp lệ, ` : ""}có thể sửa)
            </span>
          )}
        </div>
      )}

      {/* Partial success / limit exceeded warnings */}
      {limitExceeded && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Tài liệu tạo ra {cards.length} thẻ. CapyStudy hỗ trợ tối đa{" "}
          {IMPORT_MAX_ROWS.toLocaleString("vi-VN")} thẻ mỗi lần import. Hãy chia tài liệu thành phần
          nhỏ hơn.
        </div>
      )}

      {warnings && warnings.length > 0 && !limitExceeded && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">Lưu ý:</p>
          <ul className="list-inside list-disc">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {hasValidCards && <p className="mt-1">Bạn vẫn có thể import các thẻ hiện có.</p>}
        </div>
      )}

      {/* Global actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addCard} disabled={!canAdd}>
          + Thêm thẻ
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={swapAll}>
          ⇄ Đảo tất cả
        </Button>
        <span className="text-xs text-text-secondary">
          {cards.length} thẻ{invalidCards > 0 ? ` (${invalidCards} chưa hợp lệ)` : ""}
        </span>
      </div>

      {/* Card list */}
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-soft p-8 text-center text-sm text-text-secondary">
          Chưa có thẻ nào. Nhấn &quot;+ Thêm thẻ&quot; để bắt đầu.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {cards.map((card, i) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  index={i}
                  onChange={updateCard}
                  onDelete={deleteCard}
                  onSwap={swapOne}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Set name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="unified-set-name">Tên bộ</Label>
        <Input
          id="unified-set-name"
          placeholder="Nhập tên bộ flashcard"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          disabled={importing}
        />
      </div>

      {/* Import */}
      <Button onClick={() => void handleImport()} disabled={!canImport}>
        {importing ? "Đang import..." : "Tạo bộ flashcard"}
      </Button>

      {error && (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Optional source-specific content (e.g., "choose another file") */}
      {children}
    </div>
  );
}
