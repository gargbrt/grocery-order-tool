import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendWhatsappMessage } from "@/lib/whatsapp";

const FinalizeSchema = z.object({
  orderId: z.string(),
  discount: z.number().min(0).default(0),
  paymentMode: z.enum(["CASH", "UPI", "CREDIT"]),
  markPaid: z.boolean().default(false), // false => CREDIT/pending ledger entry
});

// POST /api/bills - "Verify & Send" action (steps 4-6 of the workflow):
// computes the bill from current item lines, finalizes it, writes the ledger
// entry for that Home, and sends the bill text back over the order's channel.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can finalize a bill" }, { status: 403 });
  }

  const parsed = FinalizeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { orderId, discount, paymentMode, markPaid } = parsed.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: session.storeId },
    include: { items: true, contact: true, store: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!order.contact) {
    return NextResponse.json({ error: "Order has no linked contact/home" }, { status: 400 });
  }

  const subtotal = order.items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);
  const total = Math.max(subtotal - discount, 0);

  const bill = await prisma.bill.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      subtotal,
      discount,
      total,
      paymentStatus: markPaid ? "PAID" : "CREDIT",
      paymentMode,
    },
    update: {
      subtotal,
      discount,
      total,
      paymentStatus: markPaid ? "PAID" : "CREDIT",
      paymentMode,
    },
  });

  // Ledger: running balance per Home. Positive = customer owes the store.
  const lastEntry = await prisma.ledgerEntry.findFirst({
    where: { contactId: order.contact.id },
    orderBy: { createdAt: "desc" },
  });
  const previousBalance = lastEntry?.runningBalance ?? 0;
  const delta = markPaid ? 0 : total; // if paid immediately, it doesn't add to outstanding balance
  const runningBalance = previousBalance + delta;

  await prisma.ledgerEntry.create({
    data: {
      contactId: order.contact.id,
      billId: bill.id,
      amount: total,
      runningBalance,
      note: markPaid ? "Paid at delivery" : "Added to credit",
    },
  });

  // A helper may have already marked the order DELIVERED (that's now a
  // direct status bump, not gated on this finalize step) before the owner
  // gets around to actually finalizing the bill - don't regress it back to
  // VERIFIED in that case.
  if (order.status !== "DELIVERED") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "VERIFIED" },
    });
  }

  // Send the bill back over the same channel the order came in on. Best-effort:
  // the bill and ledger entry above are already committed, so a send failure
  // (bot blocked, network blip) shouldn't turn into a 500 for something that
  // actually succeeded - the owner can always resend the bill text manually.
  const lines = order.items
    .map((i) => `${i.itemName} — ${i.quantityFulfilled || i.quantityRequested || ""} — ₹${i.lineTotal ?? 0}`)
    .join("\n");
  const text = `Your bill from ${order.store.name}:\n\n${lines}\n\nSubtotal: ₹${subtotal}\nDiscount: ₹${discount}\nTotal: ₹${total}\n\nStatus: ${markPaid ? "Paid" : "On credit"}`;
  try {
    if (order.contact.telegramChatId && order.store.telegramBotToken) {
      await sendTelegramMessage(order.store.telegramBotToken, order.contact.telegramChatId, text);
    } else if (order.contact.whatsappWaId && order.store.whatsappPhoneNumberId && order.store.whatsappAccessToken) {
      await sendWhatsappMessage(
        order.store.whatsappPhoneNumberId,
        order.store.whatsappAccessToken,
        order.contact.whatsappWaId,
        text
      );
    }
    // WhatsApp manual mode (no Cloud API creds): no auto-send possible - the
    // owner sends the bill text manually on their own phone.
  } catch (err) {
    console.error("Bill notification failed:", err);
  }

  return NextResponse.json({ bill });
}
