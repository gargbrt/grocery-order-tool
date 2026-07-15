import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { splitOrderIntoLines, assessOrderLikelihood } from "@/lib/orderParsing";
import { getCategoryFilter, type OrderCategory as Category } from "@/lib/orderCategories";

// GET /api/orders?category=all|open|review|delivered|cancelled|received&contactId=xxx&date=YYYY-MM-DD
// - list orders for the logged-in user's store.
// category:
//   all       - everything, including flagged "needs review" messages
//   open      - real orders (isLikelyOrder=true) not yet delivered/cancelled (default)
//   review    - flagged messages (isLikelyOrder=false) for the "Needs review" tab
//   delivered - status=DELIVERED
//   cancelled - status=CANCELLED
//   received  - real orders (isLikelyOrder=true), any status - matches the Summary
//               tab's "Received" count (drill-down target)
// contactId scopes to one Home (used by the Ledger detail view).
// date scopes to orders created on that calendar day (used by the calendar view).
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  // `review=true` kept as a back-compat alias for `category=review`.
  const category: Category = (params.get("category") as Category) || (params.get("review") === "true" ? "review" : "open");
  const contactId = params.get("contactId") || undefined;
  const date = params.get("date") || undefined;

  let createdAt: { gte: Date; lt: Date } | undefined;
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    createdAt = { gte: start, lt: end };
  }

  const categoryFilter = getCategoryFilter(category);

  const orders = await prisma.order.findMany({
    where: {
      storeId: session.storeId,
      ...categoryFilter,
      ...(contactId ? { contactId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    include: { items: true, contact: true, bill: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

const CreateOrderSchema = z.object({
  contactPhone: z.string().min(6),
  homeLabel: z.string().min(1),
  rawMessage: z.string().min(1),
});

// POST /api/orders - used for WhatsApp MANUAL mode: owner/helper pastes the
// customer's message here to create an Order, same as the Telegram webhook does automatically.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateOrderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { contactPhone, homeLabel, rawMessage } = parsed.data;

  let contact = await prisma.contact.findUnique({
    where: { storeId_phone: { storeId: session.storeId, phone: contactPhone } },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: { storeId: session.storeId, phone: contactPhone, homeLabel },
    });
  }

  const { isLikelyOrder, reason } = assessOrderLikelihood(rawMessage);
  const lines = splitOrderIntoLines(rawMessage);

  const order = await prisma.order.create({
    data: {
      storeId: session.storeId,
      contactId: contact.id,
      channel: "WHATSAPP",
      rawMessage,
      status: "RECEIVED",
      isLikelyOrder,
      flagReason: isLikelyOrder ? null : reason,
      items: {
        create: isLikelyOrder
          ? lines.map((line, idx) => ({
              itemName: line,
              quantityRequested: "",
              sortOrder: idx,
            }))
          : [],
      },
    },
    include: { items: true, contact: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
