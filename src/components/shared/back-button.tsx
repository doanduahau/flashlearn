"use client";

import { useBackWithFallback } from "@/hooks/use-back-with-fallback";
import { cn } from "@/lib/utils";

export function BackButton({
  fallbackHref,
  className,
  label = "← Thoát",
  ariaLabel = "Thoát",
}: Readonly<{
  fallbackHref: string;
  className?: string;
  label?: string;
  ariaLabel?: string;
}>) {
  const goBack = useBackWithFallback(fallbackHref);
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel}
      className={cn("min-h-11 px-1 text-sm underline", className)}
    >
      {label}
    </button>
  );
}
