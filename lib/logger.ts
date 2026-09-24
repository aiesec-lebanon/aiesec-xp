import "server-only";

// Every log line passes through redaction. The service token has entity-wide
// read access to AIESEC data (Architecture.md 4.3), so a single leaked log line
// is a disclosure, and an error path is exactly where a raw request object tends
// to get logged by accident.

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|credential/i;
const REDACTED = "[redacted]";

function secrets(): string[] {
  return [
    process.env.GIS_SERVICE_TOKEN,
    process.env.AIESEC_CLIENT_SECRET,
    process.env.SESSION_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    let out = value;
    for (const secret of secrets()) out = out.split(secret).join(REDACTED);
    return out;
  }

  if (value === null || typeof value !== "object") return value;

  // A cyclic object would otherwise recurse forever; request and error objects
  // routinely contain cycles.
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redact(value.message, seen),
      stack: redact(value.stack, seen),
    };
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, seen);
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  const line = {
    level,
    message: redact(message),
    ...(context ? { context: redact(context) } : {}),
    at: new Date().toISOString(),
  };
  const serialised = JSON.stringify(line);

  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
