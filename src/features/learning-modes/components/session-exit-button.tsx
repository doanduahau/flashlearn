"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="ghost"
        className={cn("size-11 shrink-0 p-0", className)}
        aria-label="Thoát phiên học"
        onClick={() => setIsConfirming(true)}
      >
        <ChevronLeft className="size-6" aria-hidden="true" />
      </Button>
      {isConfirming ? (
        <ExitConfirmDialog onCancel={() => setIsConfirming(false)} onConfirm={goBack} />
      ) : null}
    </>
  );
}
