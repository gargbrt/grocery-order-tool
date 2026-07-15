import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Period = "daily" | "weekly" | "monthly";

function getRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "daily") {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === "weekly") {
    const day = start.getDay();
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

// GET /api/summary/entries?type=money-received|receivables-added&period=daily|weekly|monthly
// Drill-down list backing the Summary tiles: which customer, how much, when.
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Summary is owner-only" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type");
  const periodParam = req.nextUrl.searchParams.get("period");
  const period: Period = periodParam === "weekly" || periodParam === "monthly" ? periodParam : "daily";
  if (type !== "money-received" && type !== "receivables-added") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const { start, end } = getRange(period);
  const paymentStatus = type === "money-received" ? "PAID" : "CREDIT";

  const bills = await prisma.bill.findMany({
    where: { paymentStatus, finalizedAt: { gte: start, lt: end }, order: { storeId: session.storeId } },
    include: { order: { include: { contact: true } } },
    orderBy: { finalizedAt: "desc" },
  });

  const entries = bills.map((b) => ({
    orderId: b.orderId,
    homeLabel: b.order.contact?.homeLabel ?? "Unknown home",
    amount: b.total,
    timestamp: b.finalizedAt,
  }));

  return NextResponse.json({ entries });
}
