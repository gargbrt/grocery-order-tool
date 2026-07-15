import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const ManualEntrySchema = z.object({
  contactId: z.string(),
  amount: z.number().positive(),
  type: z.enum(["PAYMENT", "CHARGE"]), // PAYMENT reduces the balance, CHARGE (amount due) increases it
  note: z.string().max(500).optional(),
});

// POST /api/ledger - owner manually records a payment received or an amount
// due against a Home, independent of the bill-finalize flow (e.g. an
// off-app cash payment against an old balance, or a due amount that isn't
// tied to a specific order).
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can record payments" }, { status: 403 });
  }

  const parsed = ManualEntrySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { contactId, amount, type, note } = parsed.data;

  const contact = await prisma.contact.findFirst({ where: { id: contactId, storeId: session.storeId } });
  if (!contact) return NextResponse.json({ error: "Home not found" }, { status: 404 });

  const lastEntry = await prisma.ledgerEntry.findFirst({
    where: { contactId },
    orderBy: { createdAt: "desc" },
  });
  const previousBalance = lastEntry?.runningBalance ?? 0;
  const delta = type === "PAYMENT" ? -amount : amount;
  const runningBalance = previousBalance + delta;

  const entry = await prisma.ledgerEntry.create({
    data: {
      contactId,
      amount: delta,
      runningBalance,
      note: note || (type === "PAYMENT" ? "Payment received" : "Amount due added"),
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
