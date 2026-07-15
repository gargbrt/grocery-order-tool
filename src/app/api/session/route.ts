import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/session - lets client components know the current user's role
// without duplicating auth logic; each mutating endpoint still enforces its
// own owner/helper check server-side regardless of what this returns.
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ role: session.role, userId: session.userId, storeId: session.storeId });
}
