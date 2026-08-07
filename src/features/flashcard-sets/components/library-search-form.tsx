"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      className="mt-5 max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="library-search">{label}</Label>
      <Input
        id="library-search"
        className="mt-1"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  );
}
