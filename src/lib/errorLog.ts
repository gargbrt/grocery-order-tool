// Lightweight client-side error log: keeps a rolling window in localStorage
// (so it survives a reload and is inspectable without dev tools open) and
// best-effort reports to the server for visibility in server logs. Never
// throws itself, and never blocks the caller - logging a failure must not
// become a second failure.

const STORAGE_KEY = "client-error-log";
const MAX_ENTRIES = 50;

export type LoggedError = {
  message: string;
  stack?: string;
  context?: string;
  url?: string;
  timestamp: string;
};

export function logClientError(error: unknown, context?: string) {
  const entry: LoggedError = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    if (typeof window !== "undefined") {
      const existing: LoggedError[] = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      const updated = [...existing, entry].slice(-MAX_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // localStorage can throw (quota, private browsing) - never let logging itself fail loudly
  }

  // Fire-and-forget: don't await, don't let a failed report cascade.
  try {
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }

  console.error(`[${context ?? "error"}]`, error);
}

export function getLoggedErrors(): LoggedError[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
