import { mascotAssetPath } from "@/features/mascot/utils/mascot-asset";
import type { MascotLevel, MascotState } from "@/features/mascot/types/mascot-types";

export type RunnerCharacterDrawOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  level: MascotLevel;
  state: MascotState;
};

const imageCache = new Map<string, HTMLImageElement>();

function cachedImage(path: string): HTMLImageElement | null {
  const existing = imageCache.get(path);
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  const image = new Image();
  image.src = path;
  imageCache.set(path, image);
  return image;
}

function drawFallback(ctx: CanvasRenderingContext2D, opts: RunnerCharacterDrawOptions): void {
  const radius = Math.min(opts.width, opts.height) / 2;
  const centerX = opts.x + opts.width / 2;
  const centerY = opts.y + opts.height / 2;

  ctx.save();
  ctx.fillStyle = "#fdc07f";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2e2719";
  const eyeOffset = radius * 0.3;
  ctx.beginPath();
  ctx.arc(centerX - eyeOffset, centerY - radius * 0.1, radius * 0.1, 0, Math.PI * 2);
  ctx.arc(centerX + eyeOffset, centerY - radius * 0.1, radius * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws the Runner mascot character at the given bounds. Uses the level/state
 * asset when it has loaded, otherwise a simple fallback shape so gameplay never
 * renders empty while the image is still downloading.
 */
export function drawRunnerCharacter(
  ctx: CanvasRenderingContext2D,
  opts: RunnerCharacterDrawOptions,
): void {
  const image = cachedImage(mascotAssetPath(opts.level, opts.state));
  if (image && image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, opts.x, opts.y, opts.width, opts.height);
    return;
  }
  drawFallback(ctx, opts);
}
