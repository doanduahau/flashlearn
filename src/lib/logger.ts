import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";

type LogContext = Record<string, unknown>;
type LogLevel = "info" | "warn" | "error";

const SENSITIVE_FIELD =
  /(?:authorization|cookie|token|password|secret|api[_-]?key|email|content|front|back|answer)/i;

function sanitize(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_FIELD.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function sanitizeContext(context: LogContext | undefined): LogContext {
  return sanitize(context ?? {}) as LogContext;
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "capystudy",
    environment: env.runtimeEnvironment ?? "unknown",
    ...sanitizeContext(context),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info(event: string, context?: LogContext): void {
    write("info", event, context);
  },
  warn(event: string, context?: LogContext): void {
    write("warn", event, context);
  },
  error(event: string, context?: LogContext): void {
    write("error", event, context);
    Sentry.captureMessage(event, { level: "error", extra: sanitizeContext(context) });
  },
  exception(event: string, error: unknown, context?: LogContext): void {
    write("error", event, {
      ...context,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    Sentry.captureException(error, { tags: { event }, extra: sanitizeContext(context) });
  },
};
