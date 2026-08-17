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
const spriteCache = new Map<string, HTMLCanvasElement>();

function cachedImage(path: string): HTMLImageElement | null {
  const existing = imageCache.get(path);
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  const image = new Image();
  image.src = path;
  imageCache.set(path, image);
  return image;
}

/**
 * Kicks off the image download for the states the Runner cycles through
 * (run / happy / sad) as soon as the canvas mounts, so switching character
 * state mid-game never has to wait for a fresh image fetch + decode.
 */
export function preloadRunnerCharacter(level: MascotLevel): void {
  if (typeof window === "undefined") return;
  for (const state of ["run", "happy", "sad"] as const) {
    cachedImage(mascotAssetPath(level, state));
  }
}

function spriteKey(path: string, width: number, height: number): string {
  return `${path}:${Math.round(width)}x${Math.round(height)}`;
}

/**
 * Returns a small offscreen canvas with the mascot pre-rendered at the exact
 * display size. The source PNGs are 1254x1254 (~1.2 MB), so drawing them
 * directly every frame forces a full-image downscale on each draw; rendering
 * once into a 100x120 sprite makes the per-frame drawImage nearly free.
 */
function getRunnerCharacterSprite(opts: RunnerCharacterDrawOptions): HTMLCanvasElement | null {
  const image = cachedImage(mascotAssetPath(opts.level, opts.state));
  if (!image || !image.complete || image.naturalWidth === 0) return null;
  const key = spriteKey(mascotAssetPath(opts.level, opts.state), opts.width, opts.height);
  const existing = spriteCache.get(key);
  if (existing) return existing;
  const sprite = document.createElement("canvas");
  sprite.width = Math.max(1, Math.round(opts.width));
  sprite.height = Math.max(1, Math.round(opts.height));
  const ctx = sprite.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, sprite.width, sprite.height);
  spriteCache.set(key, sprite);
  return sprite;
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
 * Draws the Runner mascot character at the given bounds using the cached
 * pre-rendered sprite. While the requested state image is still loading the
 * caller can fall back to the previously drawn sprite; the simple fallback
 * shape is only used before anything has loaded so gameplay never renders
 * empty. Returns true when a real mascot sprite was drawn.
 */
export function drawRunnerCharacter(
  ctx: CanvasRenderingContext2D,
  opts: RunnerCharacterDrawOptions,
): boolean {
  const sprite = getRunnerCharacterSprite(opts);
  if (sprite) {
    ctx.drawImage(sprite, opts.x, opts.y, opts.width, opts.height);
    return true;
  }
  drawFallback(ctx, opts);
  return false;
}
