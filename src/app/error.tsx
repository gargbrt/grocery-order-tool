"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Root-level fallback for anything outside /dashboard (login, signup) that
// doesn't have a more specific error.tsx of its own.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <ErrorScreen error={error} reset={reset} homeHref="/" />
    </main>
  );
}
