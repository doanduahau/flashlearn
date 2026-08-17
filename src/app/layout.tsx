import type { Metadata } from "next";
import { Be_Vietnam_Pro, Nunito } from "next/font/google";

import { RegisterSw } from "@/components/shared/register-sw";

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
    default: "CapyStudy",
    template: "%s | CapyStudy",
  },
  description: "Tạo bộ flashcard từ tài liệu của riêng bạn. Vừa học vừa chơi cùng CapyStudy.",
  manifest: "/manifest.webmanifest",
  applicationName: "CapyStudy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CapyStudy",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${fontSans.variable} ${fontHeading.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
