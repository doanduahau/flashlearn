"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-text-secondary"
    >
      <WifiOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>Bạn đang offline — dữ liệu có thể chưa mới nhất.</span>
    </div>
  );
}
