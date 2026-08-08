"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateCollectionForm } from "./create-collection-form";

export function CreateCollectionToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full sm:w-auto">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <FolderPlus aria-hidden="true" />
        {open ? "Đóng" : "Tạo bộ đặc biệt"}
      </Button>
      {open ? (
        <div className="mt-4 rounded-2xl border border-border-soft bg-surface p-4">
          <h3 className="font-semibold">Tạo bộ đặc biệt</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Gom thẻ từ nhiều bộ flashcard thành bộ học theo chủ đề.
          </p>
          <div className="mt-3 max-w-sm">
            <CreateCollectionForm />
          </div>
        </div>
      ) : null}
    </div>
  );
}
