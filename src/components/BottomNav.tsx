"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Orders", icon: "🧾" },
  { href: "/dashboard/contacts", label: "Homes", icon: "🏠" },
  { href: "/dashboard/ledger", label: "Ledger", icon: "📒", ownerOnly: true },
  { href: "/dashboard/team", label: "Team", icon: "👥", ownerOnly: true },
];

export function BottomNav({ role }: { role: "OWNER" | "HELPER" }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {NAV_ITEMS.filter((item) => !item.ownerOnly || role === "OWNER").map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
                active ? "text-brand-600 font-medium" : "text-gray-500"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
