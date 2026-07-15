import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, signSession, SESSION_COOKIE_NAME } from "@/lib/auth";

const SignupSchema = z.object({
  storeName: z.string().min(2).max(200),
  storeAddress: z.string().max(500).optional(),
  ownerName: z.string().min(1).max(200),
  ownerPhone: z.string().min(6).max(20),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/auth/signup - the "plug and play" entry point: creates a brand
// new Store plus its first Owner user in a single request, so a store owner
// never has to touch SQL, Prisma Studio, or the seed script to get started.
export async function POST(req: NextRequest) {
  const parsed = SignupSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { storeName, storeAddress, ownerName, ownerPhone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { phone: ownerPhone } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this phone number already exists. Try logging in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  // Store + Owner are created together, atomically - a Store should never
  // exist without at least one Owner able to log into it.
  const { store, owner } = await prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: { name: storeName, address: storeAddress },
    });
    const owner = await tx.user.create({
      data: {
        storeId: store.id,
        name: ownerName,
        phone: ownerPhone,
        passwordHash,
        role: "OWNER",
        canViewPricing: true,
        canViewContactDetails: true,
      },
    });
    return { store, owner };
  });

  const token = signSession({ userId: owner.id, storeId: store.id, role: "OWNER" });

  const res = NextResponse.json({ ok: true, storeId: store.id }, { status: 201 });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
