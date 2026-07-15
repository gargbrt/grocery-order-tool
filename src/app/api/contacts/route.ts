import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/contacts - list all Homes for the store (owner only view with full detail)
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await prisma.contact.findMany({
    where: { storeId: session.storeId },
    orderBy: { homeLabel: "asc" },
  });

  if (session.role === "HELPER") {
    const helper = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!helper?.canViewContactDetails) {
      return NextResponse.json({
        contacts: contacts.map((c) => ({ ...c, phone: "hidden", address: "hidden" })),
      });
    }
  }

  return NextResponse.json({ contacts });
}

const CreateContactSchema = z.object({
  homeLabel: z.string().min(1),
  phone: z.string().min(6),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/contacts - manually add/edit a Home profile (e.g. to properly
// label a contact that came in auto-created from Telegram/WhatsApp)
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateContactSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: { storeId: session.storeId, ...parsed.data },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
