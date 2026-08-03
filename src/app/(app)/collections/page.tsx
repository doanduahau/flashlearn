import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Bộ đặc biệt",
};

export default function CollectionsPage() {
  return (
    <PlaceholderPage
      title="Bộ đặc biệt"
      description="Gom thẻ từ nhiều bộ thông thường thành bộ học theo chủ đề của bạn."
    />
  );
}
