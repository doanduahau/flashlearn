"use client";

import { Check, LibraryBig, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { installCatalogSet } from "@/features/catalog/server/actions";

export function InstallCatalogButton({
  catalogSetId,
  installedSetId,
}: Readonly<{ catalogSetId: string; installedSetId: string | null }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const installInFlight = useRef(false);

  if (installedSetId) {
    return (
      <Button asChild variant="outline" className="min-h-11">
        <Link href={`/sets/${installedSetId}`}>
          <Check aria-hidden="true" />
          Mở bộ
        </Link>
      </Button>
    );
  }

  return (
    <div>
      <Button
        type="button"
        className="min-h-11"
        disabled={isPending}
        onClick={() => {
          if (installInFlight.current) return;
          installInFlight.current = true;
          setIsPending(true);
          setError(null);
          void (async () => {
            try {
              const result = await installCatalogSet(catalogSetId);
              if (result.ok) router.push(`/sets/${result.setId}`);
              else setError(result.error);
            } finally {
              installInFlight.current = false;
              setIsPending(false);
            }
          })();
        }}
      >
        {isPending ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <LibraryBig aria-hidden="true" />
        )}
        {isPending ? "Đang thêm..." : "Thêm vào bộ của bạn"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 max-w-sm text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
