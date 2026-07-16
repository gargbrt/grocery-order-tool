"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Scoped to everything under /dashboard. Next.js keeps dashboard/layout.tsx
// (header + bottom nav) mounted and renders this in place of just the
// failed page's content - so a crash on, say, the Ledger page doesn't take
// Orders/Homes/Team down with it. The nav bar stays clickable.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} homeHref="/dashboard" />;
}
