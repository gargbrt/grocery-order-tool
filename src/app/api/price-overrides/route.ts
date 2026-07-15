import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/price-overrides?contactId=xxx - all saved custom prices for one Home
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = req.nextUrl.searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  const overrides = await prisma.priceOverride.findMany({
    where: { contactId, storeId: session.storeId },
  });
  return NextResponse.json({ overrides });
}

const UpsertSchema = z.object({
  contactId: z.string(),
  itemName: z.string().min(1),
  price: z.number().min(0),
});

// POST /api/price-overrides - save/update "this customer pays ₹X for item Y" (owner only)
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can set custom pricing" }, { status: 403 });
  }

  const parsed = UpsertSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { contactId, itemName, price } = parsed.data;

  const contact = await prisma.contact.findFirst({ where: { id: contactId, storeId: session.storeId } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const override = await prisma.priceOverride.upsert({
    where: { contactId_itemName: { contactId, itemName: itemName.toLowerCase().trim() } },
    create: { storeId: session.storeId, contactId, itemName: itemName.toLowerCase().trim(), price },
    update: { price },
  });

  return NextResponse.json({ override });
}
