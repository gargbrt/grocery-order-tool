import { NextRequest, NextResponse } from "next/server";

// POST /api/client-errors - best-effort sink for client-side error reports
// (src/lib/errorLog.ts). No auth required - a broken session is exactly the
// kind of thing that might need logging. Just writes to server logs; there's
// no dashboard for these, but they're visible in Vercel/server log output
// for whoever's debugging a report from a user.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error("[client-error]", JSON.stringify(body));
  } catch {
    // malformed report - nothing to do, still return ok so the client doesn't retry loudly
  }
  return NextResponse.json({ ok: true });
}
