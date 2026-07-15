"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type Entry = { orderId: string; homeLabel: string; amount: number; timestamp: string };

const TITLES: Record<string, string> = {
  "money-received": "Money received",
  "receivables-added": "New receivables added",
};

export default function SummaryEntriesPage() {
  const { type } = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? "daily";
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/summary/entries?type=${type}&period=${period}`)
      .then((r) => r.json())
      .then((body) => {
        setEntries(body.entries ?? []);
        setLoading(false);
      });
  }, [type, period]);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <button onClick={() => router.back()} className="mb-3 text-sm text-brand-700">
        ← Back
      </button>

      <h2 className="mb-1 text-lg font-semibold text-gray-900">{TITLES[type] ?? "Details"}</h2>
      <p className="mb-4 text-sm text-gray-500">
        Total: ₹{total.toFixed(2)} · {entries.length} order{entries.length === 1 ? "" : "s"}
      </p>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {entries.map((e) => (
          <a
            key={e.orderId}
            href={`/dashboard/orders/${e.orderId}`}
            className="tap-target flex items-center justify-between rounded-xl2 border border-gray-200 bg-white p-3 active:scale-[0.99]"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{e.homeLabel}</p>
              <p className="text-xs text-gray-500">
                {new Date(e.timestamp).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <p className="text-sm font-semibold text-gray-900">₹{e.amount.toFixed(2)}</p>
          </a>
        ))}
        {!loading && entries.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Nothing in this period yet.
          </p>
        )}
      </div>
    </div>
  );
}
