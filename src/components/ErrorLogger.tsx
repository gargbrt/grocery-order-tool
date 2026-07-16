"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/errorLog";
import { flushQueue } from "@/lib/offlineQueue";

// Mounted once in the root layout. Catches errors that React's own error
// boundaries (error.tsx) never see: unhandled promise rejections (a failed
// fetch inside a useEffect, for instance) and errors thrown outside of
// React's render/commit cycle (event handlers, timers). Doesn't render
// anything and doesn't fix the underlying failure - it just makes sure a
// silent failure gets logged instead of vanishing. Also flushes any
// requests queued while offline, on load and as soon as the browser
// reports the connection is back.
export function ErrorLogger() {
  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      logClientError(event.reason, "unhandledrejection");
    }
    function onError(event: ErrorEvent) {
      logClientError(event.error ?? event.message, "window.onerror");
    }
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    window.addEventListener("online", flushQueue);
    flushQueue();
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      window.removeEventListener("online", flushQueue);
    };
  }, []);

  return null;
}
