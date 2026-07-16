"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusChip } from "@/components/StatusChip";
import { safeFetchJson } from "@/lib/safeFetch";
import { RetryBanner } from "@/components/RetryBanner";

type Item = {
  id: string;
  itemName: string;
  quantityRequested: string;
  quantityFulfilled: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  availability: string;
};

type Order = {
  id: string;
  status: string;
  channel: string;
  rawMessage: string;
  isLikelyOrder: boolean;
  flagReason: string | null;
  prepaid: boolean;
  contact: { id: string; homeLabel: string; phone: string } | null;
  items: Item[];
  bill: { subtotal: number; discount: number; total: number; paymentStatus: string } | null;
};

const NEXT_STATUS: Record<string, string | null> = {
  RECEIVED: "ASSIGNED",
  ASSIGNED: "FULFILLING",
  FULFILLING: "BILLED",
  // A helper can mark an order delivered directly from BILLED without
  // waiting on the owner-only bill-finalize step below - packing/delivery
  // shouldn't block on when the owner gets around to pricing it. The owner
  // can still finalize the bill (Verify & send) whenever, even after
  // delivery; see the bills route for why that no longer regresses status.
  BILLED: "DELIVERED",
  VERIFIED: "DELIVERED",
  DELIVERED: null,
};

type PriceOverride = { itemName: string; price: number };

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((body) => setIsOwner(body.role === "OWNER"))
      .catch(() => setIsOwner(false));
  }, []);

  async function load(silent = false) {
    if (!silent) setError(null);
    const result = await safeFetchJson<{ order: Order | null }>(`/api/orders/${id}`);
    if (!result.ok) {
      if (!silent) {
        setError(result.error);
        setLoading(false);
      }
      return;
    }
    const loadedOrder = result.data.order ?? null;
    setOrder(loadedOrder);
    if (!silent) setLoading(false);

    if (loadedOrder?.contact?.id) {
      const overridesResult = await safeFetchJson<{ overrides: PriceOverride[] }>(
        `/api/price-overrides?contactId=${loadedOrder.contact.id}`
      );
      setOverrides(overridesResult.ok ? overridesResult.data.overrides ?? [] : []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Prefill blank prices from saved per-customer overrides, once both are loaded
    if (!order || overrides.length === 0) return;
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.unitPrice != null) return item; // never overwrite a price already entered
          const match = overrides.find((o) => o.itemName === item.itemName.toLowerCase().trim());
          return match ? { ...item, unitPrice: match.price } : item;
        }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <RetryBanner message={error} onRetry={() => load()} />;
  if (!order) return <p className="text-sm text-gray-500">Order not found.</p>;

  async function updateItem(itemId: string, patch: Partial<Item>) {
    setOrder((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : prev
    );
  }

  async function saveItems() {
    if (!order) return;
    setSaving(true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: order.items.map((i) => ({
          id: i.id,
          quantityFulfilled: i.quantityFulfilled ?? undefined,
          unitPrice: i.unitPrice,
          availability: i.availability,
        })),
      }),
    });
    setSaving(false);
    load();
  }

  async function savePriceOverride(itemName: string, price: number) {
    if (!order?.contact?.id) return;
    await fetch("/api/price-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: order.contact.id, itemName, price }),
    });
  }

  async function acceptAsOrder() {
    if (!order) return;
    setSaving(true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptAsOrder: true }),
    });
    setSaving(false);
    load();
  }

  async function dismissFlaggedMessage() {
    if (!order) return;
    setSaving(true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    setSaving(false);
    router.push("/dashboard");
  }

  async function cancelOrder() {
    if (!order) return;
    if (!window.confirm("Mark this order as cancelled? This can't be undone.")) return;
    setSaving(true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    setSaving(false);
    router.push("/dashboard");
  }

  async function advanceStatus() {
    if (!order) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function finalizeBill(markPaid: boolean) {
    if (!order) return;
    setSaving(true);
    await fetch(`/api/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, discount, paymentMode: markPaid ? "UPI" : "CREDIT", markPaid }),
    });
    setSaving(false);
    load();
  }

  const computedTotal = order.items.reduce((sum, i) => sum + (i.lineTotal ?? (i.unitPrice ?? 0)), 0);
  const finalTotal = Math.max(computedTotal - discount, 0);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 transform-gpu bg-[#f4f7fb] px-4 pb-3 pt-4">
        <button onClick={() => router.back()} className="mb-3 text-sm text-brand-700">
          ← Back
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{order.contact?.homeLabel ?? "Unknown home"}</h2>
            <p className="text-xs text-gray-500">{order.contact?.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={order.status} paymentStatus={order.bill?.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="mt-4">

      {order.prepaid && !order.bill && (
        <div className="mb-4 rounded-xl2 border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm font-medium text-brand-700">💰 Marked as already paid for</p>
          <p className="mt-0.5 text-xs text-brand-600">
            Use "Verify & send (paid)" when billing so it doesn't add to the customer's credit balance.
          </p>
        </div>
      )}

      {isOwner && !["DELIVERED", "CANCELLED"].includes(order.status) && (
        <button
          onClick={cancelOrder}
          disabled={saving}
          className="tap-target mb-4 w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          Cancel order (not a real order / mistake)
        </button>
      )}

      <div className="mb-4 rounded-xl2 border border-gray-200 bg-white p-3">
        <p className="mb-1 text-xs font-medium text-gray-500">Original message</p>
        <p className="whitespace-pre-wrap text-sm text-gray-800">{order.rawMessage}</p>
      </div>

      {!order.isLikelyOrder && (
        <div className="mb-4 rounded-xl2 border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">Flagged for review</p>
          <p className="mt-0.5 text-xs text-amber-700">{order.flagReason ?? "Doesn't look like a typical order."}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={dismissFlaggedMessage}
              className="tap-target flex-1 rounded-lg border border-amber-300 py-2 text-sm font-medium text-amber-800"
            >
              Not an order
            </button>
            <button
              onClick={acceptAsOrder}
              disabled={saving}
              className="tap-target flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white"
            >
              {saving ? "Saving…" : "This is an order"}
            </button>
          </div>
        </div>
      )}

      {order.isLikelyOrder && (
      <>
      <div className="space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-xl2 border border-gray-200 bg-white p-3">
            <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
            {item.quantityRequested && (
              <p className="mb-2 text-xs text-gray-500">Requested: {item.quantityRequested}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Qty fulfilled"
                value={item.quantityFulfilled ?? ""}
                onChange={(e) => updateItem(item.id, { quantityFulfilled: e.target.value })}
                className="tap-target rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Amount ₹"
                  value={item.unitPrice ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, { unitPrice: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="tap-target w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <button
                  title="Save this price for this customer going forward"
                  onClick={() => item.unitPrice != null && savePriceOverride(item.itemName, item.unitPrice)}
                  disabled={item.unitPrice == null}
                  className="tap-target shrink-0 rounded-lg border border-gray-300 px-2 text-sm disabled:opacity-30"
                >
                  💾
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">Amount is the total for this line, not a per-unit rate.</p>
            <div className="mt-2 flex gap-1.5">
              {["AVAILABLE", "UNAVAILABLE", "SUBSTITUTED"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateItem(item.id, { availability: opt })}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    item.availability === opt ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {opt.charAt(0) + opt.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={saveItems}
        disabled={saving}
        className="tap-target mt-3 w-full rounded-lg border border-brand-600 py-2 text-sm font-medium text-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save items"}
      </button>

      <div className="mt-4 rounded-xl2 border border-gray-200 bg-white p-3">
        {order.bill ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Subtotal</p>
              <p className="text-sm font-medium text-gray-900">₹{order.bill.subtotal.toFixed(2)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-gray-600">Discount</p>
              <p className="text-sm font-medium text-gray-900">₹{order.bill.discount.toFixed(2)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <p className="text-sm font-medium text-gray-700">Total ({order.bill.paymentStatus})</p>
              <p className="text-lg font-semibold text-gray-900">₹{order.bill.total.toFixed(2)}</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Items total</p>
              <p className="text-sm font-medium text-gray-900">₹{computedTotal.toFixed(2)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="text-sm text-gray-600">Overall discount ₹</label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="tap-target w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm"
              />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <p className="text-sm font-medium text-gray-700">Final total</p>
              <p className="text-lg font-semibold text-gray-900">₹{finalTotal.toFixed(2)}</p>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 mt-4 flex gap-2">
        {NEXT_STATUS[order.status] && (
          <button
            onClick={advanceStatus}
            className="tap-target flex-1 rounded-lg bg-gray-800 py-2.5 text-sm font-medium text-white"
          >
            Mark as {NEXT_STATUS[order.status]?.toLowerCase()}
          </button>
        )}
        {isOwner && (order.status === "FULFILLING" || order.status === "BILLED") && (
          <>
            <button
              onClick={() => finalizeBill(false)}
              className="tap-target flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white"
            >
              Verify & send (credit)
            </button>
            <button
              onClick={() => finalizeBill(true)}
              className="tap-target flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white"
            >
              Verify & send (paid)
            </button>
          </>
        )}
      </div>
      </>
      )}
      </div>
    </div>
  );
}
