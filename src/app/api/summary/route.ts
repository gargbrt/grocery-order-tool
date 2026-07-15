import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Period = "daily" | "weekly" | "monthly";

// Calendar-based ranges (not rolling windows): "today", "this week (Mon-Sun)",
// "this calendar month" - matches how a store owner naturally thinks about
// "today's/this week's/this month's numbers".
function getRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "daily") {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === "weekly") {
    const day = start.getDay(); // 0 = Sunday
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: monthStart, end: monthEnd };
}

// GET /api/summary?period=daily|weekly|monthly - owner-only accounting snapshot:
// orders received/delivered/cancelled in the period, money received and new
// receivables booked in the period, and the store's current total outstanding.
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Summary is owner-only" }, { status: 403 });
  }

  const periodParam = req.nextUrl.searchParams.get("period");
  const period: Period = periodParam === "weekly" || periodParam === "monthly" ? periodParam : "daily";
  const { start, end } = getRange(period);

  const [ordersReceived, deliveredCount, cancelledCount, paidBills, creditBills, contacts] = await Promise.all([
    prisma.order.count({
      where: { storeId: session.storeId, isLikelyOrder: true, createdAt: { gte: start, lt: end } },
    }),
    prisma.auditLog.count({
      where: {
        action: "STATUS_CHANGE",
        detail: { endsWith: "-> DELIVERED" },
        createdAt: { gte: start, lt: end },
        order: { storeId: session.storeId },
      },
    }),
    // isLikelyOrder: true here so a dismissed "Needs Review" message (never
    // counted in ordersReceived, since that's real-orders-only) doesn't
    // inflate this count and break the received vs delivered+cancelled math.
    prisma.auditLog.count({
      where: {
        action: "STATUS_CHANGE",
        detail: { endsWith: "-> CANCELLED" },
        createdAt: { gte: start, lt: end },
        order: { storeId: session.storeId, isLikelyOrder: true },
      },
    }),
    prisma.bill.findMany({
      where: { paymentStatus: "PAID", finalizedAt: { gte: start, lt: end }, order: { storeId: session.storeId } },
      select: { total: true },
    }),
    prisma.bill.findMany({
      where: { paymentStatus: "CREDIT", finalizedAt: { gte: start, lt: end }, order: { storeId: session.storeId } },
      select: { total: true },
    }),
    prisma.contact.findMany({
      where: { storeId: session.storeId },
      include: { ledgerEntries: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const moneyReceived = paidBills.reduce((sum, b) => sum + b.total, 0);
  const receivablesAdded = creditBills.reduce((sum, b) => sum + b.total, 0);
  const totalOutstanding = contacts.reduce((sum, c) => sum + (c.ledgerEntries[0]?.runningBalance ?? 0), 0);

  return NextResponse.json({
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    ordersReceived,
    ordersDelivered: deliveredCount,
    ordersCancelled: cancelledCount,
    moneyReceived,
    receivablesAdded,
    totalOutstanding,
  });
}
