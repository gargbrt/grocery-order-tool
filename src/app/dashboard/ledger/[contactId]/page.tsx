"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusChip } from "@/components/StatusChip";

type Contact = { id: string; homeLabel: string; phone: string };
type LedgerEntry = {
  id: string;
  amount: number;
  runningBalance: number;
  note: string | null;
  createdAt: string;
};
type OrderSummary = {
  id: string;
  status: string;
  createdAt: string;
  items: { id: string }[];
  bill: { total: number; paymentStatus: string } | null;
};

export default function LedgerDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(silent = false) {
    const [contactBody, ledgerBody, ordersBody] = await Promise.all([
      fetch(`/api/contacts/${contactId}`).then((r) => r.json()),
      fetch(`/api/ledger?contactId=${contactId}`).then((r) => r.json()),
      fetch(`/api/orders?category=all&contactId=${contactId}`).then((r) => r.json()),
    ]);
    setContact(contactBody.contact ?? null);
    setEntries(ledgerBody.entries ?? []);
    setOrders(ordersBody.orders ?? []);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const currentBalance = entries[0]?.runningBalance ?? 0;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-3 text-sm text-brand-700">
        ← Back
      </button>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && contact && (
        <>
          <h2 className="text-lg font-semibold text-gray-900">{contact.homeLabel}</h2>
          <p className="mb-4 text-xs text-gray-500">{contact.phone}</p>

          <div className="mb-4 rounded-xl2 border border-gray-200 bg-white p-3">
            <p className="text-sm text-gray-600">Current balance</p>
            <p className={`text-xl font-semibold ${currentBalance > 0 ? "text-amber-600" : "text-brand-600"}`}>
              ₹{currentBalance.toFixed(2)}
            </p>
          </div>

          <h3 className="mb-2 text-sm font-semibold text-gray-700">Orders</h3>
          <div className="mb-4 space-y-2">
            {orders.map((o) => (
              <a
                key={o.id}
                href={`/dashboard/orders/${o.id}`}
                className="tap-target flex items-center justify-between rounded-xl2 border border-gray-200 bg-white p-3 active:scale-[0.99]"
              >
                <div>
                  <p className="text-sm text-gray-900">
                    {o.items.length} item{o.items.length === 1 ? "" : "s"} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </p>
                  {o.bill && <p className="text-xs text-gray-500">₹{o.bill.total.toFixed(2)} · {o.bill.paymentStatus}</p>}
                </div>
                <StatusChip status={o.status} />
              </a>
            ))}
            {orders.length === 0 && <p className="text-sm text-gray-500">No orders yet.</p>}
          </div>

          <h3 className="mb-2 text-sm font-semibold text-gray-700">Payment / credit history</h3>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-xl2 border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-900">{e.note ?? "Ledger entry"}</p>
                  <p className={`text-sm font-medium ${e.amount > 0 ? "text-amber-600" : "text-brand-600"}`}>
                    ₹{e.amount.toFixed(2)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {new Date(e.createdAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · Balance after: ₹{e.runningBalance.toFixed(2)}
                </p>
              </div>
            ))}
            {entries.length === 0 && <p className="text-sm text-gray-500">No payment/credit entries yet.</p>}
          </div>
        </>
      )}

      {!loading && !contact && <p className="text-sm text-gray-500">Home not found.</p>}
    </div>
  );
}
