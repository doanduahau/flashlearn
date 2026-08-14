export const logger = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") console.info("[capystudy:info]", ...args);
  },
  warn: (...args: unknown[]) => console.warn("[capystudy:warn]", ...args),
  error: (...args: unknown[]) => console.error("[capystudy:error]", ...args),
};
