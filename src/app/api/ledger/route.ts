import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/ledger?contactId=xxx - full ledger history for one Home.
// Without contactId, returns current outstanding balance for every Home (owner only).
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Ledger is owner-only" }, { status: 403 });
  }

  const contactId = req.nextUrl.searchParams.get("contactId");

  if (contactId) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { contactId, contact: { storeId: session.storeId } },
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    });
    return NextResponse.json({ entries });
  }

  // Latest entry per contact = current balance snapshot
  const contacts = await prisma.contact.findMany({
    where: { storeId: session.storeId },
    include: {
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const balances = contacts.map((c) => ({
    contactId: c.id,
    homeLabel: c.homeLabel,
    balance: c.ledgerEntries[0]?.runningBalance ?? 0,
    lastActivityAt: c.ledgerEntries[0]?.createdAt ?? null,
  }));

  return NextResponse.json({ balances });
}
