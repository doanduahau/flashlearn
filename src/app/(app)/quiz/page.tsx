import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Kiểm tra",
};

export default function QuizPage() {
  return (
    <PlaceholderPage
      title="Kiểm tra"
      description="Thiết lập bài test từ một hoặc nhiều bộ flashcard."
    />
  );
}
