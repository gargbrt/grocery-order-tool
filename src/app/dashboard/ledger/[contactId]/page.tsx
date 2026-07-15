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
  const [showRecordEntry, setShowRecordEntry] = useState(false);

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

          <button
            onClick={() => setShowRecordEntry(true)}
            className="tap-target mb-4 w-full rounded-lg border border-brand-600 py-2 text-sm font-medium text-brand-700"
          >
            Record payment / add amount due
          </button>

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

      {showRecordEntry && (
        <RecordEntryModal
          contactId={contactId}
          onClose={() => setShowRecordEntry(false)}
          onSaved={() => {
            setShowRecordEntry(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RecordEntryModal({
  contactId,
  onClose,
  onSaved,
}: {
  contactId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"PAYMENT" | "CHARGE">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, amount: Number(amount), type, note: note || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't save - check the amount and try again.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl2">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Record payment / amount due</h3>
        <div className="space-y-3">
          <div className="flex gap-2 rounded-full bg-gray-100 p-1">
            <button
              onClick={() => setType("PAYMENT")}
              className={`tap-target flex-1 rounded-full text-sm font-medium ${
                type === "PAYMENT" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
              }`}
            >
              Payment received
            </button>
            <button
              onClick={() => setType("CHARGE")}
              className={`tap-target flex-1 rounded-full text-sm font-medium ${
                type === "CHARGE" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500"
              }`}
            >
              Amount due
            </button>
          </div>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount ₹"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Note (optional, e.g. 'Cash paid at shop')"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="tap-target flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !amount || Number(amount) <= 0}
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
