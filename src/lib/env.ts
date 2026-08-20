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
  UPSTASH_REDIS_REST_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  CAPYSTUDY_ENVIRONMENT: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "test", "staging", "production"]).optional(),
  ),
  CAPYSTUDY_CATALOG_ENABLED: z.enum(["true", "false"]).default("false"),
  CAPYSTUDY_STARTER_PROVISIONING_ENABLED: z.enum(["true", "false"]).default("false"),
  CAPYSTUDY_QUOTA_ENFORCEMENT_MODE: z.enum(["observe", "warn", "block"]).default("observe"),
  CAPYSTUDY_ADMIN_CONSOLE_ENABLED: z.enum(["true", "false"]).default("false"),
  CAPYSTUDY_BILLING_ENABLED: z.enum(["true", "false"]).default("false"),
  /** @deprecated Use CAPYSTUDY_ENVIRONMENT. */
  FLASHLEARN_ENVIRONMENT: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "test", "staging", "production"]).optional(),
  ),
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
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  CAPYSTUDY_ENVIRONMENT: process.env.CAPYSTUDY_ENVIRONMENT,
  CAPYSTUDY_CATALOG_ENABLED: process.env.CAPYSTUDY_CATALOG_ENABLED,
  CAPYSTUDY_STARTER_PROVISIONING_ENABLED: process.env.CAPYSTUDY_STARTER_PROVISIONING_ENABLED,
  CAPYSTUDY_QUOTA_ENFORCEMENT_MODE: process.env.CAPYSTUDY_QUOTA_ENFORCEMENT_MODE,
  CAPYSTUDY_ADMIN_CONSOLE_ENABLED: process.env.CAPYSTUDY_ADMIN_CONSOLE_ENABLED,
  CAPYSTUDY_BILLING_ENABLED: process.env.CAPYSTUDY_BILLING_ENABLED,
  FLASHLEARN_ENVIRONMENT: process.env.FLASHLEARN_ENVIRONMENT,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

if (
  parsed.data.CAPYSTUDY_ENVIRONMENT &&
  parsed.data.FLASHLEARN_ENVIRONMENT &&
  parsed.data.CAPYSTUDY_ENVIRONMENT !== parsed.data.FLASHLEARN_ENVIRONMENT
) {
  throw new Error(
    "CAPYSTUDY_ENVIRONMENT and legacy FLASHLEARN_ENVIRONMENT must match when both are set",
  );
}

export const env = {
  ...parsed.data,
  runtimeEnvironment:
    parsed.data.CAPYSTUDY_ENVIRONMENT ?? parsed.data.FLASHLEARN_ENVIRONMENT ?? process.env.NODE_ENV,
};

export function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || env.runtimeEnvironment === "test";
}

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
