"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/errorLog";

// Shared body for every error.tsx boundary in the app. Deliberately never
// blocks the rest of the app - the surrounding layout (header, bottom nav)
// stays mounted and usable, since Next.js only swaps out the failed
// segment's content, not its parent layout. The user can always navigate
// away via the nav that's still on screen, or use the buttons here.
export function ErrorScreen({
  error,
  reset,
  homeHref = "/dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
}) {
  useEffect(() => {
    logClientError(error, "error-boundary");
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-8 text-center">
      <p className="text-3xl">⚠️</p>
      <h2 className="mt-3 text-base font-semibold text-gray-900">Something went wrong on this screen</h2>
      <p className="mt-1 max-w-xs text-sm text-gray-500">
        The rest of the app still works - you can go back, head home, or try this screen again.
      </p>
      <div className="mt-5 flex w-full max-w-xs gap-2">
        <button
          onClick={() => (typeof window !== "undefined" ? window.history.back() : undefined)}
          className="tap-target flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
        >
          Go back
        </button>
        <a
          href={homeHref}
          className="tap-target flex-1 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-700"
        >
          Home
        </a>
        <button
          onClick={reset}
          className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
