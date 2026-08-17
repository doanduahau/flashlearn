"use client";

import { useEffect, useRef } from "react";

import type { MascotLevel, MascotState } from "@/features/mascot/types/mascot-types";
import type { Feedback, RunnerDifficulty, RunnerEvent, RunnerState } from "../types/runner-types";
import { calculateRunnerSpeed, getRunnerDifficultyConfig } from "../utils/runner-difficulty";
import { rectsOverlap } from "../utils/collision";
import { drawRunnerCharacter, preloadRunnerCharacter } from "../art/runner-character";

const CHARACTER_WIDTH = 100;
const CHARACTER_HEIGHT = 120;
const CHARACTER_POSITION_RATIO = 0.3;
const BOTTOM_MARGIN = 24;
const FOOD_SIZE = 44;
const SKY_HEIGHT = 135;
const JUMP_VELOCITY = 0.75;
const GRAVITY = 0.0018;
const MAX_DELTA_MS = 50;
const BURST_MS = 300;
const CHARACTER_STATE_MS = 600;

const FRUIT_EMOJIS = ["🍌", "🍊", "🍎"] as const;

type Burst = { kind: "correct" | "wrong"; x: number; y: number; until: number };

const foodSprites = new Map<string, HTMLCanvasElement>();

/**
 * Pre-renders a fruit emoji at DEVICE pixel size (FOOD_SIZE * dpr) once per
 * fruit + dpr combination, so the game loop only blits a small bitmap and
 * the emoji stays crisp on hi-dpi screens (no canvas upscale).
 */
function getFoodSprite(emoji: string, dpr: number): HTMLCanvasElement | null {
  const key = `${emoji}:${dpr}`;
  const existing = foodSprites.get(key);
  if (existing) return existing;
  if (typeof document === "undefined") return null;
  const sprite = document.createElement("canvas");
  sprite.width = Math.max(1, Math.round(FOOD_SIZE * dpr));
  sprite.height = Math.max(1, Math.round(FOOD_SIZE * dpr));
  const ctx = sprite.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${Math.round(FOOD_SIZE * 0.8 * dpr)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, sprite.width / 2, sprite.height / 2);
  foodSprites.set(key, sprite);
  return sprite;
}

export function RunnerCanvas({
  stateRef,
  dispatch,
  difficulty,
  mascotLevel,
}: Readonly<{
  stateRef: React.RefObject<RunnerState>;
  dispatch: (event: RunnerEvent) => void;
  difficulty: RunnerDifficulty;
  mascotLevel: MascotLevel;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerEl: HTMLDivElement = container;
    const canvasEl: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = ctx;

    const timePerItemMs = getRunnerDifficultyConfig(difficulty).timePerItemMs;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Start fetching the character states used mid-game so switching to
    // happy/sad never flashes a placeholder while an image downloads.
    preloadRunnerCharacter(mascotLevel);

    let cssWidth = 0;
    let cssHeight = 0;
    let rafId = 0;
    let lastTime: number | null = null;
    let laidOut = false;

    let charY = 0;
    let charVy = 0;
    let foodX = -FOOD_SIZE;
    let lastItemSeq = -1;
    let lastFeedback: Feedback | null = null;
    let burst: Burst | null = null;
    let characterState: "run" | "happy" | "sad" = "run";
    let characterStateUntil = 0;
    let lastDrawnState: MascotState | null = null;
    let currentDpr = window.devicePixelRatio || 1;
    let speed = 0;

    function groundY(): number {
      return cssHeight - BOTTOM_MARGIN;
    }

    function characterX(): number {
      return cssWidth * CHARACTER_POSITION_RATIO - CHARACTER_WIDTH / 2;
    }

    function resize(): void {
      const rect = containerEl.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      const dpr = window.devicePixelRatio || 1;
      currentDpr = dpr;
      canvasEl.width = Math.max(1, Math.round(cssWidth * dpr));
      canvasEl.height = Math.max(1, Math.round(cssHeight * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      speed = calculateRunnerSpeed(Math.max(cssWidth, 1), timePerItemMs);
      if (!laidOut) {
        laidOut = true;
        charY = groundY() - CHARACTER_HEIGHT;
      } else if (charY > groundY() - CHARACTER_HEIGHT) {
        charY = groundY() - CHARACTER_HEIGHT;
      }
    }

    function drawCharacter(): void {
      const opts = {
        x: characterX(),
        y: charY,
        width: CHARACTER_WIDTH,
        height: CHARACTER_HEIGHT,
        level: mascotLevel,
        state: characterState,
        dpr: currentDpr,
      };
      if (drawRunnerCharacter(context, opts)) {
        lastDrawnState = characterState;
        return;
      }
      // The requested state image is still loading: keep the previous visual
      // instead of showing the plain placeholder shape mid-game.
      if (lastDrawnState !== null && lastDrawnState !== characterState) {
        drawRunnerCharacter(context, { ...opts, state: lastDrawnState });
        return;
      }
      // Nothing has loaded yet: draw the placeholder so the area is not empty.
      drawRunnerCharacter(context, opts);
    }

    function draw(state: RunnerState): void {
      context.clearRect(0, 0, cssWidth, cssHeight);

      const gy = groundY();
      context.strokeStyle = "#eaddcb";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, gy);
      context.lineTo(cssWidth, gy);
      context.stroke();

      // Food in the sky (Fruit: 🍌 Chuối, 🍊 Cam, 🍎 Táo).
      const foodY = gy - CHARACTER_HEIGHT - SKY_HEIGHT;
      if (foodX >= -FOOD_SIZE && state.status !== "ready") {
        const fruitEmoji = FRUIT_EMOJIS[Math.abs(state.itemSeq) % FRUIT_EMOJIS.length];
        const fruitSprite = getFoodSprite(fruitEmoji, currentDpr);
        if (fruitSprite) {
          context.drawImage(fruitSprite, foodX, foodY, FOOD_SIZE, FOOD_SIZE);
        } else {
          context.font = `${Math.round(FOOD_SIZE * 0.8)}px sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(fruitEmoji, foodX + FOOD_SIZE / 2, foodY + FOOD_SIZE / 2);
        }
      }

      // Character.
      drawCharacter();

      // Feedback burst.
      if (burst && !reducedMotion) {
        context.fillStyle = burst.kind === "correct" ? "#65be91" : "#ef8585";
        context.globalAlpha = 0.5;
        context.beginPath();
        context.arc(burst.x + FOOD_SIZE / 2, burst.y + FOOD_SIZE / 2, FOOD_SIZE, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    }

    function frame(now: number): void {
      rafId = requestAnimationFrame(frame);
      const delta = lastTime === null ? 0 : Math.min(now - lastTime, MAX_DELTA_MS);
      lastTime = now;
      if (delta > 0) dispatch({ type: "TICK", deltaMs: delta });

      const state = stateRef.current;

      if (state.status === "playing") {
        if (state.itemSeq !== lastItemSeq) {
          lastItemSeq = state.itemSeq;
          foodX = cssWidth + FOOD_SIZE;
        }

        const gy = groundY();
        if (state.jumpState === "airborne" && charY >= gy - CHARACTER_HEIGHT && charVy >= 0) {
          charVy = -JUMP_VELOCITY;
        }
        charVy += GRAVITY * delta;
        charY += charVy * delta;
        if (charY >= gy - CHARACTER_HEIGHT) {
          charY = gy - CHARACTER_HEIGHT;
          charVy = 0;
          if (state.jumpState === "airborne") dispatch({ type: "LAND" });
        }

        foodX -= speed * delta;
        const foodY = gy - CHARACTER_HEIGHT - SKY_HEIGHT;
        const characterHitbox = {
          x: characterX() + CHARACTER_WIDTH * 0.2,
          y: charY + CHARACTER_HEIGHT * 0.2,
          width: CHARACTER_WIDTH * 0.6,
          height: CHARACTER_HEIGHT * 0.6,
        };
        const foodHitbox = { x: foodX, y: foodY, width: FOOD_SIZE, height: FOOD_SIZE };

        if (rectsOverlap(characterHitbox, foodHitbox)) {
          dispatch({ type: "HIT_ACTIVE_ITEM", itemSeq: state.itemSeq });
        } else if (foodX + FOOD_SIZE < characterX()) {
          dispatch({ type: "PASS_ACTIVE_ITEM", itemSeq: state.itemSeq });
        }

        if (state.feedback !== lastFeedback) {
          lastFeedback = state.feedback;
          if (state.feedback) {
            if (!reducedMotion) {
              burst = { kind: state.feedback.kind, x: foodX, y: foodY, until: now + BURST_MS };
            }
            characterState = state.feedback.kind === "correct" ? "happy" : "sad";
            characterStateUntil = now + CHARACTER_STATE_MS;
          }
        }
        if (now >= characterStateUntil) characterState = "run";
        if (burst && now >= burst.until) burst = null;
      }

      draw(state);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerEl);
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [dispatch, stateRef, difficulty, mascotLevel]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
