import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isMoneyReceivedEntry } from "@/lib/summaryQueries";
import { parsePeriod, getRange } from "@/lib/summaryRange";

// GET /api/summary/entries?type=money-received|receivables-added&period=...
// Drill-down list backing the Summary tiles: which customer, how much, when.
// Pulls from LedgerEntry (not Bill) so manual payments/amounts-due recorded
// straight against a Home show up here too, same as the Summary totals.
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Summary is owner-only" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "money-received" && type !== "receivables-added") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const period = parsePeriod(req.nextUrl.searchParams.get("period"));
  const { start, end } = getRange(period, {
    start: req.nextUrl.searchParams.get("start"),
    end: req.nextUrl.searchParams.get("end"),
  });

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { createdAt: { gte: start, lt: end }, contact: { storeId: session.storeId } },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
  });

  const billIds = ledgerEntries.filter((e) => e.billId).map((e) => e.billId as string);
  const bills = billIds.length
    ? await prisma.bill.findMany({ where: { id: { in: billIds } }, select: { id: true, paymentStatus: true } })
    : [];
  const billStatusById = new Map(bills.map((b) => [b.id, b.paymentStatus]));

  const entries = ledgerEntries
    .filter((e) => {
      const isReceived = isMoneyReceivedEntry({
        amount: e.amount,
        billId: e.billId,
        billPaymentStatus: e.billId ? billStatusById.get(e.billId) ?? null : null,
      });
      return type === "money-received" ? isReceived : !isReceived;
    })
    .map((e) => ({
      contactId: e.contactId,
      homeLabel: e.contact.homeLabel,
      amount: Math.abs(e.amount),
      note: e.note,
      timestamp: e.createdAt,
    }));

  return NextResponse.json({ entries });
}
