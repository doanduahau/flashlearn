"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LibrarySearchForm({
  defaultValue,
  label,
  placeholder,
}: Readonly<{
  defaultValue: string;
  label: string;
  placeholder: string;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function submit(): void {
    const params = new URLSearchParams(searchParams.toString());
    const query = value.trim();
    params.delete("page");
    if (query) params.set("q", query);
    else params.delete("q");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  return (
    <form
      className="mt-2 flex gap-2 sm:mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor="library-search">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
        <input
          id="library-search"
          aria-label={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-xl border border-border-soft bg-surface py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-11"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" className="min-h-9 shrink-0 sm:min-h-11">
        Tìm
      </Button>
    </form>
  );
}
