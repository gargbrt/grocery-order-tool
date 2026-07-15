import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractWhatsappTextMessage, sendWhatsappMessage } from "@/lib/whatsapp";
import { splitOrderIntoLines, assessOrderLikelihood, parseOrderLine } from "@/lib/orderParsing";

// GET: Meta's one-time webhook verification handshake. When you register the
// webhook URL in the Meta for Developers dashboard, Meta calls this with a
// challenge and expects it echoed back if the verify token matches.
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  if (mode === "subscribe" && token === store.whatsappVerifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST: actual incoming messages from customers.
export async function POST(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const payload = await req.json();
  const parsed = extractWhatsappTextMessage(payload);
  if (!parsed) {
    // Non-text update (delivery receipt, read receipt, image, etc.) - ignore politely
    return NextResponse.json({ ok: true });
  }

  const { from, text, name } = parsed;

  let contact = await prisma.contact.findFirst({
    where: { storeId: store.id, whatsappWaId: from },
  });
  if (!contact) {
    // Also try matching on a phone number the owner may have already added manually
    contact = await prisma.contact.findFirst({
      where: { storeId: store.id, phone: { contains: from.slice(-10) } },
    });
  }
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        storeId: store.id,
        homeLabel: name,
        phone: `+${from}`,
        whatsappWaId: from,
      },
    });
  } else if (!contact.whatsappWaId) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { whatsappWaId: from },
    });
  }

  const { isLikelyOrder, reason } = assessOrderLikelihood(text);
  const lines = splitOrderIntoLines(text);

  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      contactId: contact.id,
      channel: "WHATSAPP",
      rawMessage: text,
      status: "RECEIVED",
      isLikelyOrder,
      flagReason: isLikelyOrder ? null : reason,
      items: {
        create: isLikelyOrder
          ? lines.map((line, idx) => ({ ...parseOrderLine(line), sortOrder: idx }))
          : [],
      },
    },
  });

  // Only auto-reply if we're within the 24h free-form window, which we are
  // by definition here (this IS the customer's inbound message triggering it),
  // and only if credentials are configured.
  if (store.whatsappPhoneNumberId && store.whatsappAccessToken) {
    const replyText = isLikelyOrder
      ? `Got your order! We're on it and will send your bill once it's packed.`
      : `Thanks for your message! If this was an order, please send items one per line and we'll get started.`;
    try {
      await sendWhatsappMessage(store.whatsappPhoneNumberId, store.whatsappAccessToken, from, replyText);
    } catch (err) {
      // Don't fail the webhook over a reply failure - the order is already saved.
      console.error("WhatsApp reply failed:", err);
    }
  }

  return NextResponse.json({ ok: true, orderId: order.id, isLikelyOrder });
}
