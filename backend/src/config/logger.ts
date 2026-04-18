type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, payload?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const meta = payload ? ` ${JSON.stringify(payload)}` : "";
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info: (message: string, payload?: Record<string, unknown>): void =>
    write("info", message, payload),
  warn: (message: string, payload?: Record<string, unknown>): void =>
    write("warn", message, payload),
  error: (message: string, payload?: Record<string, unknown>): void =>
    write("error", message, payload),
};
