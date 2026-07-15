import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { splitOrderIntoLines } from "@/lib/orderParsing";

async function loadOrderScoped(orderId: string, storeId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true, contact: true, bill: true, assignedTo: true },
  });
}

// GET /api/orders/:id - returns order detail, redacted for helpers without pricing/contact permission
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await loadOrderScoped(params.id, session.storeId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.role === "HELPER") {
    const helper = await prisma.user.findUnique({ where: { id: session.userId } });
    const redacted = {
      ...order,
      bill: helper?.canViewPricing ? order.bill : null,
      items: order.items.map((i) =>
        helper?.canViewPricing ? i : { ...i, unitPrice: null, lineTotal: null }
      ),
      contact: helper?.canViewContactDetails
        ? order.contact
        : order.contact
        ? { ...order.contact, phone: "hidden", address: "hidden" }
        : null,
    };
    return NextResponse.json({ order: redacted });
  }

  return NextResponse.json({ order });
}

const UpdateSchema = z.object({
  status: z
    .enum(["RECEIVED", "ASSIGNED", "FULFILLING", "BILLED", "VERIFIED", "DELIVERED", "CANCELLED"])
    .optional(),
  assignedToId: z.string().nullable().optional(),
  acceptAsOrder: z.boolean().optional(), // moves a flagged "Needs review" message into the real Orders list
  items: z
    .array(
      z.object({
        id: z.string(),
        quantityFulfilled: z.string().optional(),
        unitPrice: z.number().nullable().optional(),
        availability: z.enum(["PENDING", "AVAILABLE", "UNAVAILABLE", "SUBSTITUTED"]).optional(),
        substitutionNote: z.string().optional(),
      })
    )
    .optional(),
});

// PATCH /api/orders/:id - update status, assignment, or item fulfillment/pricing.
// This single endpoint intentionally covers steps 3-6 of the workflow (assign -> fulfill -> bill -> verify)
// so the frontend can save incrementally as the helper checks off items.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await loadOrderScoped(params.id, session.storeId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, assignedToId, items, acceptAsOrder } = parsed.data;

  if (acceptAsOrder && !order.isLikelyOrder) {
    // Regenerate items from the raw message now that a human has confirmed it's a real order
    const lines = splitOrderIntoLines(order.rawMessage);
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        isLikelyOrder: true,
        flagReason: null,
        items: { create: lines.map((line, idx) => ({ itemName: line, quantityRequested: "", sortOrder: idx })) },
      },
    });
  }

  // Only owners (or helpers with pricing permission) can set unitPrice
  if (items?.some((i) => i.unitPrice !== undefined)) {
    if (session.role === "HELPER") {
      const helper = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!helper?.canViewPricing) {
        return NextResponse.json(
          { error: "Not permitted to set pricing" },
          { status: 403 }
        );
      }
    }
  }

  if (items) {
    // Security: item.id comes from the request body. Without this check, a
    // request could pass an OrderItem id belonging to a completely different
    // store's order, and the update below would silently modify it - a
    // cross-tenant data leak. `order` (from loadOrderScoped) is already
    // scoped to this store, so we only allow updates to items that are
    // actually part of THIS order.
    const validItemIds = new Set(order.items.map((i) => i.id));
    const invalidIds = items.filter((i) => !validItemIds.has(i.id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "One or more items do not belong to this order" },
        { status: 403 }
      );
    }

    for (const item of items) {
      let lineTotal: number | undefined;
      if (item.unitPrice != null) {
        // Parse the fulfilled-quantity free text. Only fall back to 1 when the
        // field is genuinely empty/unparseable - NOT when it parses to a valid
        // 0 (e.g. helper explicitly marked 0 fulfilled for an unavailable item).
        // A naive `parseFloat(x) || 1` fallback treats 0 as falsy and would
        // wrongly bill a full unit for an item the customer never received.
        const parsedQty = item.quantityFulfilled ? parseFloat(item.quantityFulfilled) : NaN;
        const qty = Number.isNaN(parsedQty) ? 1 : parsedQty;
        lineTotal = item.availability === "UNAVAILABLE" ? 0 : item.unitPrice * qty;
      }
      // updateMany + orderId in the where clause as defense-in-depth, even
      // though we already validated membership above - belt and suspenders
      // against this check ever being bypassed by a future code change.
      await prisma.orderItem.updateMany({
        where: { id: item.id, orderId: order.id },
        data: {
          quantityFulfilled: item.quantityFulfilled,
          unitPrice: item.unitPrice ?? undefined,
          lineTotal,
          availability: item.availability,
          substitutionNote: item.substitutionNote,
        },
      });
    }
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: status ?? undefined,
      assignedToId: assignedToId === undefined ? undefined : assignedToId,
    },
    include: { items: true, contact: true, bill: true },
  });

  if (status) {
    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        userId: session.userId,
        action: "STATUS_CHANGE",
        detail: `${order.status} -> ${status}`,
      },
    });
  }

  return NextResponse.json({ order: updated });
}
