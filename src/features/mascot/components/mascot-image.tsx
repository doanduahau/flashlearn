import type { MascotLevel, MascotState } from "../types/mascot-types";
import { mascotAssetPath } from "../utils/mascot-asset";
import Image from "next/image";

export function MascotImage({
  level,
  state,
  size = 96,
  className,
  loading = "lazy",
}: Readonly<{
  level: MascotLevel;
  state: MascotState;
  size?: number;
  className?: string;
  loading?: "eager" | "lazy";
}>) {
  return (
    <Image
      src={mascotAssetPath(level, state)}
      alt=""
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      loading={loading}
    />
  );
}
