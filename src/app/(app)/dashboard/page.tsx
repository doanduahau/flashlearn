import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <PlaceholderPage title="Dashboard" description="Tổng quan học tập của bạn." />;
}
