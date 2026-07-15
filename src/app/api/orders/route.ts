import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { splitOrderIntoLines, assessOrderLikelihood } from "@/lib/orderParsing";

// GET /api/orders?status=RECEIVED&review=true - list orders for the logged-in user's store.
// review=true returns only flagged (isLikelyOrder=false) orders for the "Needs review" tab;
// by default (no review param) flagged orders are excluded from the main list.
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const review = req.nextUrl.searchParams.get("review") === "true";

  const orders = await prisma.order.findMany({
    where: {
      storeId: session.storeId,
      isLikelyOrder: review ? false : true,
      ...(status ? { status: status as any } : {}),
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
