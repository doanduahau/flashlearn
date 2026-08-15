"use client";

import { useState } from "react";

import { useBackWithFallback } from "@/hooks/use-back-with-fallback";
import { cn } from "@/lib/utils";
import { ExitConfirmDialog } from "./exit-confirm-dialog";

export function SessionExitButton({
  fallbackHref,
  className,
}: Readonly<{
  fallbackHref: string;
  className?: string;
}>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const goBack = useBackWithFallback(fallbackHref);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label="Thoát phiên học"
        className={cn("min-h-11 px-1 text-sm underline", className)}
      >
        ← Thoát
      </button>
      {isConfirming ? (
        <ExitConfirmDialog onCancel={() => setIsConfirming(false)} onConfirm={goBack} />
      ) : null}
    </>
  );
}
