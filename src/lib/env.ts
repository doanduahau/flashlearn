import { z } from "zod";

import { isCapyStudyProductionSupabaseUrl } from "@/lib/supabase/production-project";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://127.0.0.1:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_PICKER_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID: z.string().optional(),
  NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_PICKER_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY,
  NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID,
  NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL:
    process.env.NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}

export function getGeminiApiKey(): string | undefined {
  return env.GEMINI_API_KEY || undefined;
}

function assertLocalSupabaseSafety(url: string): void {
  if (
    process.env.NODE_ENV === "development" &&
    isCapyStudyProductionSupabaseUrl(url) &&
    env.NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL !== "1"
  ) {
    throw new Error(
      "Refusing to use the production Supabase project from local development. Set NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL=1 only for intentional read-only diagnostics.",
    );
  }
}

export function getSupabasePublishableConfig(): SupabaseConfig {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set in .env.local",
    );
  }

  assertLocalSupabaseSafety(env.NEXT_PUBLIC_SUPABASE_URL);

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getSupabaseServiceConfig(): SupabaseServiceConfig {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  assertLocalSupabaseSafety(env.NEXT_PUBLIC_SUPABASE_URL);

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
