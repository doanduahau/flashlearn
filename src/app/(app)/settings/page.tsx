import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Cài đặt",
};

export default function SettingsPage() {
  return <PlaceholderPage title="Cài đặt" description="Hồ sơ và thiết lập tài khoản của bạn." />;
}
