type LogLevel = "debug" | "info" | "warn" | "error";

const enabled: Record<LogLevel, boolean> = {
  debug: import.meta.env.DEV,
  info: true,
  warn: true,
  error: true,
};

function emit(level: LogLevel, ...args: unknown[]): void {
  if (!enabled[level]) return;
  if (level === "error") console.error("[rudra]", ...args);
  else if (level === "warn") console.warn("[rudra]", ...args);
  else console.info("[rudra]", ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", ...args),
  info: (...args: unknown[]) => emit("info", ...args),
  warn: (...args: unknown[]) => emit("warn", ...args),
  error: (...args: unknown[]) => emit("error", ...args),
};
