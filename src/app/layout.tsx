import type { Metadata } from "next";
import { Be_Vietnam_Pro, Nunito } from "next/font/google";

import "./globals.css";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-flash-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const fontHeading = Nunito({
  variable: "--font-flash-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "FlashLearn",
    template: "%s | FlashLearn",
  },
  description: "Biến bất kỳ file Excel hai cột nào thành bộ flashcard và bài kiểm tra thông minh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${fontSans.variable} ${fontHeading.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
