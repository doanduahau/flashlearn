"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getMasteryPresentation,
  MASTERY_STATUS_ORDER,
} from "@/features/mastery/presentation/mastery-presentation";
import { cn } from "@/lib/utils";

export function MasteryLegend() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function close(): void {
      setIsOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    function onPointerDown(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        close();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label="Trạng thái học"
        title="Trạng thái học"
      >
        <Info aria-hidden="true" />
        <span className="hidden sm:inline">Trạng thái học</span>
      </Button>
      {isOpen ? (
        <div
          ref={panelRef}
          role="region"
          aria-label="Chú thích trạng thái học"
          className="absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card"
        >
          <ul className="space-y-2">
            {MASTERY_STATUS_ORDER.map((status) => {
              const presentation = getMasteryPresentation(status);
              return (
                <li key={status} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn("size-2 rounded-full", presentation.indicatorClassName)}
                  />
                  <span>{presentation.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
