"use client";

import { useEffect } from "react";

// Catches an error in the root layout itself (very rare - everything else
// is caught by the more specific error.tsx boundaries). Must render its own
// <html>/<body> since it replaces the entire root layout when triggered.
// Kept intentionally plain (inline styles, no Tailwind classes, no other
// components) since the thing that broke might be upstream of all of that.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: error.message, stack: error.stack, context: "global-error" }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore - this is the last-resort handler, it must not itself throw
    }
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "2rem" }}>⚠️</p>
        <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>The app hit an unexpected error</h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: "0.5rem 0 1.5rem" }}>
          Reloading usually fixes this.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.5rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
