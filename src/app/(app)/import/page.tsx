import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Import",
};

export default function ImportPage() {
  return (
    <PlaceholderPage title="Import" description="Nhập file Excel hoặc CSV để tạo bộ flashcard." />
  );
}
