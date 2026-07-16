import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  receivedWhere,
  statusChangeWhere,
  openOrdersWhere,
  classifyLedgerEntries,
  sumBalanceDelta,
  type LedgerFlowEntry,
} from "@/lib/summaryQueries";
import { totalOrderValue, totalOrderValueInRange } from "@/lib/customerValue";
import { parsePeriod, getRange } from "@/lib/summaryRange";

// GET /api/summary?period=daily|weekly|monthly|fy|all|custom[&start=YYYY-MM-DD&end=YYYY-MM-DD]
// Owner-only accounting snapshot: orders received/open/delivered in the
// period, plus a 3-row money-movement table (total billed, money received,
// net receivables/total outstanding) - each showing the current cumulative
// (all-time) figure and how much it moved in the selected period.
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Summary is owner-only" }, { status: 403 });
  }

  const period = parsePeriod(req.nextUrl.searchParams.get("period"));
  const { start, end } = getRange(period, {
    start: req.nextUrl.searchParams.get("start"),
    end: req.nextUrl.searchParams.get("end"),
  });

  const [ordersReceived, openCount, deliveredCount, contacts] = await Promise.all([
    prisma.order.count({ where: receivedWhere(session.storeId, start, end) }),
    prisma.order.count({ where: openOrdersWhere(session.storeId, start, end) }),
    prisma.auditLog.count({ where: statusChangeWhere(session.storeId, start, end, "DELIVERED") }),
    prisma.contact.findMany({
      where: { storeId: session.storeId },
      include: {
        // Full history (not just the latest), so cumulative + period money
        // movement can both be derived from one query instead of two.
        ledgerEntries: { orderBy: { createdAt: "desc" } },
        orders: { include: { bill: true } },
      },
    }),
  ]);

  // Bill-driven ledger entries don't carry their bill's paymentStatus inline
  // (LedgerEntry.billId is a plain id, not a Prisma relation) - build the
  // lookup from the same contacts query instead of a separate bills query.
  const billStatusById = new Map<string, string>();
  for (const c of contacts) {
    for (const o of c.orders) {
      if (o.bill) billStatusById.set(o.bill.id, o.bill.paymentStatus);
    }
  }

  const allEntries: (LedgerFlowEntry & { createdAt: Date })[] = contacts.flatMap((c) =>
    c.ledgerEntries.map((e) => ({
      amount: e.amount,
      billId: e.billId,
      billPaymentStatus: e.billId ? billStatusById.get(e.billId) ?? null : null,
      createdAt: e.createdAt,
    }))
  );
  const periodEntries = allEntries.filter((e) => e.createdAt >= start && e.createdAt < end);

  const cumulativeFlow = classifyLedgerEntries(allEntries);
  const periodFlow = classifyLedgerEntries(periodEntries);
  const periodOutstandingChange = sumBalanceDelta(periodEntries);

  const totalOutstanding = contacts.reduce((sum, c) => sum + (c.ledgerEntries[0]?.runningBalance ?? 0), 0);
  const cumulativeBilled = contacts.reduce((sum, c) => sum + totalOrderValue(c.orders), 0);
  const periodBilled = contacts.reduce((sum, c) => sum + totalOrderValueInRange(c.orders, start, end), 0);

  // Top customers by lifetime order value - all-time, independent of the
  // period toggle above (a "best customers" view, not a period-scoped one).
  const topCustomers = contacts
    .map((c) => ({ contactId: c.id, homeLabel: c.homeLabel, totalOrderValue: totalOrderValue(c.orders) }))
    .filter((c) => c.totalOrderValue > 0)
    .sort((a, b) => b.totalOrderValue - a.totalOrderValue)
    .slice(0, 10);

  return NextResponse.json({
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    ordersReceived,
    ordersOpen: openCount,
    ordersDelivered: deliveredCount,
    totalBilled: { cumulative: cumulativeBilled, change: periodBilled },
    moneyReceived: { cumulative: cumulativeFlow.moneyReceived, change: periodFlow.moneyReceived },
    totalOutstanding: { cumulative: totalOutstanding, change: periodOutstandingChange },
    topCustomers,
  });
}
