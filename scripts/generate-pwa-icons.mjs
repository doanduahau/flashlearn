// Generates the PWA icons from public/mascot/logo.png into public/icons/.
//
// Outputs (design-token background #f8fbf7):
//   icon-192.png                — 192x192 regular
//   icon-512.png                — 512x512 regular
//   icon-maskable-512.png       — 512x512 with safe-zone padding (~80% content)
//   apple-touch-icon.png        — 180x180
//
// Run: node scripts/generate-pwa-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const SOURCE = "./public/mascot/logo.png";
const OUT_DIR = "./public/icons";
const BACKGROUND = "#f8fbf7";
const SAFE_ZONE_RATIO = 0.8;

const targets = [
  { name: "icon-192.png", size: 192, padding: 0 },
  { name: "icon-512.png", size: 512, padding: 0 },
  { name: "icon-maskable-512.png", size: 512, padding: SAFE_ZONE_RATIO },
  { name: "apple-touch-icon.png", size: 180, padding: 0 },
];

mkdirSync(OUT_DIR, { recursive: true });

const source = await loadImage(SOURCE);

for (const target of targets) {
  const canvas = createCanvas(target.size, target.size);
  const ctx = canvas.getContext("2d");

  // Opaque background (manifest requires non-transparent icons on iOS).
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, target.size, target.size);

  // Keep a square content box inside the canvas.
  const contentSize = target.size * target.padding || target.size;
  const offset = (target.size - contentSize) / 2;

  // The mascot logo has transparency; draw it scaled to the content box.
  ctx.drawImage(source, offset, offset, contentSize, contentSize);

  const buffer = canvas.toBuffer("image/png");
  writeFileSync(`${OUT_DIR}/${target.name}`, buffer);
  console.log(`wrote ${OUT_DIR}/${target.name} (${buffer.length} bytes)`);
}

console.log("PWA icons generated.");
