"use client";

import { useSearchParams } from "next/navigation";

export function SignUpErrorDisplay() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  if (!error) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
      {error}
    </div>
  );
}
