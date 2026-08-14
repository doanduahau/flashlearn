import type { MascotLevel, MascotState } from "../types/mascot-types";

export function mascotAssetPath(level: MascotLevel, state: MascotState): string {
  return `/mascot/level-${level}/${state}.png`;
}
