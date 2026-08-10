import { expect, type BrowserContext } from "@playwright/test";

import { requireLocalEndpoint } from "./local-endpoints";

export function supabaseApiUrl(): string {
  return requireLocalEndpoint("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; run E2E through "npm run test:e2e".',
    );
  }
  return key;
}

function localServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Missing local SUPABASE_SERVICE_ROLE_KEY; run E2E through "npm run test:e2e".');
  }
  return key;
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

/** Local E2E fixture setup only. Never available to browser application code. */
export async function localSupabaseAdminRest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const key = localServiceRoleKey();
  return fetch(`${supabaseApiUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
