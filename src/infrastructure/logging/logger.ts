/** Minimal logging boundary so the repository can warn about corrupt rows without binding to console. */
export interface Logger {
  warn(message: string, meta?: unknown): void;
}

/** Default logger over the platform console. */
export const consoleLogger: Logger = {
  warn(message: string, meta?: unknown): void {
    if (meta === undefined) {
      console.warn(message);
    } else {
      console.warn(message, meta);
    }
  },
};
