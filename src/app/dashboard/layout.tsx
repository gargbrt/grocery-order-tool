import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BottomNav } from "@/components/BottomNav";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) {
    redirect("/login");
    return null;
  }

  const store = await prisma.store.findUnique({ where: { id: session.storeId } });

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">{store?.name ?? "Store"}</h1>
          <p className="text-xs text-gray-500">{session.role === "OWNER" ? "Owner view" : "Helper view"}</p>
        </div>
        <LogoutButton />
      </header>
      <main className="px-4 py-4">{children}</main>
      <BottomNav role={session.role} />
    </div>
  );
}
