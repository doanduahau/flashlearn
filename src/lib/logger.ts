export const logger = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") console.info("[flashlearn:info]", ...args);
  },
  warn: (...args: unknown[]) => console.warn("[flashlearn:warn]", ...args),
  error: (...args: unknown[]) => console.error("[flashlearn:error]", ...args),
};
