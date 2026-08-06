"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CardSearchForm({ defaultValue }: Readonly<{ defaultValue: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function submit(): void {
    const query = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (query) params.set("q", query);
    else params.delete("q");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="card-search">Tìm thẻ</Label>
      <Input
        id="card-search"
        className="mt-1 max-w-sm"
        value={value}
        placeholder="Tìm theo mặt trước hoặc mặt sau"
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  );
}
