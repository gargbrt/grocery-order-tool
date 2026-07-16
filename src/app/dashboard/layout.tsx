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
    <div className="mx-auto flex h-screen max-w-md flex-col">
      <header className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">{store?.name ?? "Store"}</h1>
          <p className="text-xs text-gray-500">{session.role === "OWNER" ? "Owner view" : "Helper view"}</p>
        </div>
        <LogoutButton />
      </header>
      {/* The single scroll container for page content - each page's own
          title/tabs/filters use `sticky top-0` relative to this element, so
          only the list beneath them scrolls. */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">{children}</main>
      <BottomNav role={session.role} />
    </div>
  );
}
