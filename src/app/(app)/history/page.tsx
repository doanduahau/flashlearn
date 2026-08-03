import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Lịch sử",
};

export default function HistoryPage() {
  return <PlaceholderPage title="Lịch sử" description="Lịch sử các bài kiểm tra của bạn." />;
}
