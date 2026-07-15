import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

// GET /api/team - list everyone with access to this store (owner only)
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can view the team" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { storeId: session.storeId },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      canViewPricing: true,
      canViewContactDetails: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

const InviteHelperSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(6).max(20),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  canViewPricing: z.boolean().default(false),
  canViewContactDetails: z.boolean().default(false),
});

// POST /api/team - owner creates a helper login for this store. This is the
// plug-and-play replacement for what used to require Prisma Studio/SQL.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can invite helpers" }, { status: 403 });
  }

  const parsed = InviteHelperSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, phone, password, canViewPricing, canViewContactDetails } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return NextResponse.json({ error: "A user with this phone number already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const helper = await prisma.user.create({
    data: {
      storeId: session.storeId,
      name,
      phone,
      passwordHash,
      role: "HELPER",
      canViewPricing,
      canViewContactDetails,
    },
    select: { id: true, name: true, phone: true, role: true },
  });

  return NextResponse.json({ helper }, { status: 201 });
}
