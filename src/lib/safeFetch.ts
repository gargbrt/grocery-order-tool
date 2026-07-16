import { logClientError } from "./errorLog";

export type SafeFetchResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Wraps fetch+json in a try/catch that never throws - a network failure
// (offline, DNS, timeout) rejects the fetch promise itself, which if left
// unhandled inside a useEffect becomes an unhandled promise rejection that
// crashes the page in dev and silently wedges it in prod ("Loading..."
// forever, no error and no way to recover). Callers get a result they can
// branch on instead, and can show a retry affordance.
export async function safeFetchJson<T = unknown>(url: string, options?: RequestInit): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = typeof body?.error === "string" ? body.error : `Request failed (${res.status})`;
      return { ok: false, error: message };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    logClientError(err, `fetch ${url}`);
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
