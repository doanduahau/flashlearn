import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/sets": ["./node_modules/@napi-rs/canvas/**/*", "./node_modules/@napi-rs/canvas-*/**/*"],
  },
};

export default nextConfig;
