import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Học",
};

export default function StudyPage() {
  return (
    <PlaceholderPage title="Học" description="Chọn phạm vi học và luyện tập với thẻ flashcard." />
  );
}
