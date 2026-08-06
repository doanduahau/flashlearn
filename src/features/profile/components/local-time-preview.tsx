"use client";

import { useEffect, useState } from "react";

import { formatLocalTime } from "@/features/profile/utils/local-time";

const REFRESH_INTERVAL_MS = 60_000;

export function LocalTimePreview({ timezone }: Readonly<{ timezone: string }>) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="text-sm text-text-secondary">
      Giờ địa phương ở {timezone}:{" "}
      <span className="font-medium text-text-primary">{formatLocalTime(now, timezone)}</span>
    </p>
  );
}
