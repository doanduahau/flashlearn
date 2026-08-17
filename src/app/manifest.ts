import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CapyStudy",
    short_name: "CapyStudy",
    description: "Tạo bộ flashcard từ tài liệu của riêng bạn. Vừa học vừa chơi cùng CapyStudy.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fbf7",
    theme_color: "#7bcfa6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
