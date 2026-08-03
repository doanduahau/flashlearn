import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Thống kê",
};

export default function StatisticsPage() {
  return (
    <PlaceholderPage
      title="Thống kê & Streak"
      description="Theo dõi streak, độ chính xác và các thẻ cần ôn."
    />
  );
}
