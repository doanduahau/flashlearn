"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return !navigator.onLine;
}

// The server snapshot is always "online" so the server-rendered markup matches
// the client's initial (pre-hydration) render, avoiding a hydration mismatch.
// useSyncExternalStore then applies the real value after hydration.
function getServerSnapshot(): boolean {
  return false;
}

export function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
