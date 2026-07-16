// Queues POST requests that fail due to a network error (not validation) so
// they aren't lost when the connection drops mid-action. Flushed on 'online'
// and on next app load; a request that comes back rejected once the network
// is up (e.g. stale data) is dropped rather than retried forever.

import { logClientError } from "./errorLog";

const STORAGE_KEY = "offline-request-queue";

export type QueuedRequest = {
  id: string;
  url: string;
  body: unknown;
  label: string;
  createdAt: string;
};

function readQueue(): QueuedRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedRequest[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore (quota/private browsing)
  }
}

export function getQueue(): QueuedRequest[] {
  return readQueue();
}

export function enqueue(req: { url: string; body: unknown; label: string }): void {
  const queue = readQueue();
  queue.push({ ...req, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString() });
  writeQueue(queue);
}

function removeFromQueue(id: string) {
  writeQueue(readQueue().filter((r) => r.id !== id));
}

let flushInFlight = false;

export async function flushQueue(): Promise<void> {
  if (flushInFlight) return;
  flushInFlight = true;
  try {
    for (const req of readQueue()) {
      try {
        const res = await fetch(req.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        });
        if (!res.ok) {
          logClientError(new Error(`Queued request rejected on retry: ${req.label}`), "offline-queue-flush");
        }
        removeFromQueue(req.id);
      } catch {
        // still offline - stop here, leave this and later items queued for next attempt
        return;
      }
    }
  } finally {
    flushInFlight = false;
  }
}
