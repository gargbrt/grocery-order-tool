import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/contacts/:id - single Home's detail (used by the Ledger detail view)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contact = await prisma.contact.findFirst({ where: { id: params.id, storeId: session.storeId } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.role === "HELPER") {
    const helper = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!helper?.canViewContactDetails) {
      return NextResponse.json({ contact: { ...contact, phone: "hidden", address: "hidden" } });
    }
  }

  return NextResponse.json({ contact });
}

const UpdateContactSchema = z.object({
  homeLabel: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// PATCH /api/contacts/:id - edit a Home's label/phone/address/notes. Owner only.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can edit Homes" }, { status: 403 });
  }

  const existing = await prisma.contact.findFirst({ where: { id: params.id, storeId: session.storeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = UpdateContactSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const contact = await prisma.contact.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  return NextResponse.json({ contact });
}
