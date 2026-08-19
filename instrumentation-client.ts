import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.FLASHLEARN_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.FLASHLEARN_ENVIRONMENT === "production" ? 0.1 : 1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
});
