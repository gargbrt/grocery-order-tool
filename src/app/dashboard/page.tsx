"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderCard } from "@/components/OrderCard";
import { MiniCalendar } from "@/components/MiniCalendar";
import { toE164 } from "@/components/PhoneInput";
import { HomePicker, type ContactSuggestion } from "@/components/HomePicker";

type Order = {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  prepaid: boolean;
  contact: { homeLabel: string } | null;
  items: { id: string }[];
};

type Category = "all" | "open" | "review" | "delivered" | "cancelled";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "review", label: "Needs Review" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const VALID_CATEGORIES: Category[] = ["all", "open", "review", "delivered", "cancelled"];

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as Category | null;
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [tab, setTab] = useState<Category>(
    initialCategory && VALID_CATEGORIES.includes(initialCategory) ? initialCategory : "all"
  );
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ category: tab });
    if (selectedDate) params.set("date", selectedDate);
    const [ordersRes, reviewRes] = await Promise.all([
      fetch(`/api/orders?${params.toString()}`),
      fetch("/api/orders?category=review"),
    ]);
    const ordersBody = await ordersRes.json();
    const reviewBody = await reviewRes.json();
    setOrders(ordersBody.orders ?? []);
    setReviewCount((reviewBody.orders ?? []).length);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    // Near-real-time refresh: picks up orders/status changes made from other
    // devices/sessions (e.g. a helper's phone, or the owner logged in elsewhere)
    // without the user having to manually reload.
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDate]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRecordPayment(true)}
            className="tap-target rounded-full border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700"
          >
            Record payment
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="tap-target rounded-full bg-brand-600 px-3 py-2 text-sm font-medium text-white"
          >
            + WhatsApp order
          </button>
        </div>
      </div>

      <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />

      {selectedDate && (
        <div className="mb-3 flex items-center justify-between rounded-xl2 border border-brand-200 bg-brand-50 px-3 py-2">
          <p className="text-xs font-medium text-brand-700">
            Showing orders for{" "}
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
          <button onClick={() => setSelectedDate(null)} className="text-xs font-medium text-brand-700 underline">
            Clear
          </button>
        </div>
      )}

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setTab(c.key)}
            className={`tap-target shrink-0 rounded-full px-3 text-sm font-medium ${
              tab === c.key
                ? c.key === "review"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {c.label}
            {c.key === "review" && reviewCount > 0 ? ` (${reviewCount})` : ""}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && orders.length === 0 && (
        <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          {tab === "all"
            ? 'No orders yet. Orders sent to your Telegram bot appear here automatically. For WhatsApp (manual mode), tap "+ WhatsApp order" to paste one in.'
            : "No orders in this category."}
        </p>
      )}

      <div className="space-y-3">
        {orders.map((o) => (
          <OrderCard
            key={o.id}
            id={o.id}
            homeLabel={o.contact?.homeLabel ?? "Unknown"}
            channel={o.channel}
            status={o.status}
            itemCount={o.items.length}
            createdAt={o.createdAt}
            prepaid={o.prepaid}
          />
        ))}
      </div>

      {showAdd && <AddWhatsappOrderModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {showRecordPayment && <RecordPaymentModal onClose={() => setShowRecordPayment(false)} />}
    </div>
  );
}

function AddWhatsappOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [homeLabel, setHomeLabel] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [rawMessage, setRawMessage] = useState("");
  const [prepaid, setPrepaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeLabel, contactPhone: toE164(contactPhone), rawMessage, prepaid }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Could not save order — check the fields and try again.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl2">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Paste WhatsApp order</h3>
        <div className="space-y-3">
          <HomePicker
            homeLabel={homeLabel}
            phone={contactPhone}
            onHomeLabelChange={setHomeLabel}
            onPhoneChange={setContactPhone}
          />
          <textarea
            placeholder={"Paste the order message, one item per line\ne.g.\n2 kg rice\n1 packet atta"}
            value={rawMessage}
            onChange={(e) => setRawMessage(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={prepaid} onChange={(e) => setPrepaid(e.target.checked)} />
            Already paid for
          </label>
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
            disabled={submitting || !homeLabel || !contactPhone || !rawMessage}
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Create order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({ onClose }: { onClose: () => void }) {
  const [homeLabel, setHomeLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState<ContactSuggestion | null>(null);
  const [type, setType] = useState<"PAYMENT" | "CHARGE">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!contact) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, amount: Number(amount), type, note: note || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't save - check the amount and try again.");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl2">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Record payment / amount due</h3>
        <div className="space-y-3">
          <HomePicker
            homeLabel={homeLabel}
            phone={phone}
            onHomeLabelChange={setHomeLabel}
            onPhoneChange={setPhone}
            onContactMatch={setContact}
            homeLabelPlaceholder="Search Homes by name"
          />
          {!contact && (homeLabel || phone) && (
            <p className="text-xs text-amber-600">
              No matching Home selected yet - pick one from the suggestions.
            </p>
          )}
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
            disabled={submitting || !contact || !amount || Number(amount) <= 0}
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
