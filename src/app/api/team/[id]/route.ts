import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

const UpdateTeamMemberSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(6).max(20).optional(),
  canViewPricing: z.boolean().optional(),
  canViewContactDetails: z.boolean().optional(),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).optional(),
});

// PATCH /api/team/:id - owner edits their own info, or a helper's info/permissions,
// and/or resets a password (their own, or a helper's - no old password needed
// when the owner is resetting a helper's, since the owner already authenticated).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can edit team members" }, { status: 403 });
  }

  const target = await prisma.user.findFirst({ where: { id: params.id, storeId: session.storeId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = UpdateTeamMemberSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, phone, canViewPricing, canViewContactDetails, newPassword } = parsed.data;

  if (phone && phone !== target.phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "A user with this phone number already exists" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      name: name ?? undefined,
      phone: phone ?? undefined,
      canViewPricing: canViewPricing ?? undefined,
      canViewContactDetails: canViewContactDetails ?? undefined,
      passwordHash: newPassword ? await hashPassword(newPassword) : undefined,
    },
    select: { id: true, name: true, phone: true, role: true, canViewPricing: true, canViewContactDetails: true },
  });

  return NextResponse.json({ user: updated });
}

// DELETE /api/team/:id - owner removes a helper's login. Restricted to
// HELPER accounts only - never lets anyone delete an OWNER through this
// route, regardless of who's asking. Orders/audit log rows referencing this
// helper (assignment, "who changed this") are kept - only the user-account
// link is cleared, so order and billing history stay intact after the
// helper's login is gone.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the store owner can remove team members" }, { status: 403 });
  }

  const target = await prisma.user.findFirst({ where: { id: params.id, storeId: session.storeId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role !== "HELPER") {
    return NextResponse.json({ error: "Only helper accounts can be removed this way" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.order.updateMany({ where: { assignedToId: target.id }, data: { assignedToId: null } }),
    prisma.auditLog.updateMany({ where: { userId: target.id }, data: { userId: null } }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
