import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type BrowserContext } from "@playwright/test";

function readEnv(name: string): string {
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === name) return trimmed.slice(eq + 1).trim();
  }
  throw new Error(`Missing ${name} in .env.local`);
}

export function supabaseApiUrl(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function supabaseAnonKey(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

async function authTokenCookie(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  const chunks = cookies
    .filter((entry) => /auth-token\.\d+$/.test(entry.name))
    .sort((a, b) => {
      const an = Number(a.name.match(/auth-token\.(\d+)$/)?.[1] ?? 0);
      const bn = Number(b.name.match(/auth-token\.(\d+)$/)?.[1] ?? 0);
      return an - bn;
    });
  expect(chunks.length, "expected Supabase auth token cookies").toBeGreaterThan(0);
  return chunks.map((entry) => entry.value.replace(/^base64-/, "")).join("");
}

export async function accessToken(context: BrowserContext): Promise<string> {
  const raw = await authTokenCookie(context);
  const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  return parsed.access_token as string;
}

export async function authSubject(context: BrowserContext): Promise<string> {
  const token = await accessToken(context);
  const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf8"));
  return payload.sub as string;
}

export async function supabaseRest(
  context: BrowserContext,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await accessToken(context);
  return fetch(`${supabaseApiUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
