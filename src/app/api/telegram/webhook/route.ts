import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { splitOrderIntoLines, assessOrderLikelihood, parseOrderLine } from "@/lib/orderParsing";

// Telegram calls this URL every time a customer messages the store's bot.
// URL shape: /api/telegram/webhook/[storeId]?secret=xxxx  (see route segment below)
// For simplicity in this MVP we identify the store by a query param that was
// baked into the webhook URL when it was registered (setTelegramWebhook).

export async function POST(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json({ error: "Missing storeId" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !store.telegramBotToken) {
    return NextResponse.json({ error: "Store not configured for Telegram" }, { status: 404 });
  }

  const update = await req.json();
  const message = update?.message;
  if (!message?.text || !message?.chat?.id) {
    // Not a text message (could be a sticker, join event, etc.) - ignore politely
    return NextResponse.json({ ok: true });
  }

  const chatId: string = String(message.chat.id);
  const text: string = message.text;
  const fromName: string =
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || "Customer";

  // Handle the /start command as onboarding, not as an order
  if (text.trim().startsWith("/start")) {
    await sendTelegramMessage(
      store.telegramBotToken,
      chatId,
      `Hi! You're connected to ${store.name}. Just send your order as a message (one item per line) and we'll take it from here.`
    );
    return NextResponse.json({ ok: true });
  }

  // Find or create the Home/Contact for this Telegram chat
  let contact = await prisma.contact.findFirst({
    where: { storeId: store.id, telegramChatId: chatId },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        storeId: store.id,
        homeLabel: fromName, // owner can rename this to a proper "Home" label later
        phone: `telegram:${chatId}`, // placeholder until owner links a real phone number
        telegramChatId: chatId,
      },
    });
  }

  const { isLikelyOrder, reason } = assessOrderLikelihood(text);
  const lines = splitOrderIntoLines(text);

  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      contactId: contact.id,
      channel: "TELEGRAM",
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

  const replyText = isLikelyOrder
    ? `Got your order! We're on it and will send your bill once it's packed. (Order #${order.id.slice(-6)})`
    : `Thanks for your message! If this was an order, please send items one per line and we'll get started.`;

  await sendTelegramMessage(store.telegramBotToken, chatId, replyText);

  return NextResponse.json({ ok: true, orderId: order.id });
}
