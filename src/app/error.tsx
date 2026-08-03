"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl font-extrabold">Có lỗi xảy ra</h1>
      <p className="text-text-secondary">Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.</p>
      <Button variant="outline" onClick={reset}>
        Thử lại
      </Button>
    </main>
  );
}
