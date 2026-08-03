import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Bộ flashcard",
};

export default function SetsPage() {
  return (
    <PlaceholderPage
      title="Bộ flashcard"
      description="Danh sách các bộ flashcard thông thường của bạn."
    />
  );
}
