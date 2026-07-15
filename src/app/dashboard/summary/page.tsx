"use client";

import { useEffect, useState } from "react";

type Period = "daily" | "weekly" | "monthly";

type Summary = {
  period: Period;
  range: { start: string; end: string };
  ordersReceived: number;
  ordersDelivered: number;
  ordersCancelled: number;
  moneyReceived: number;
  receivablesAdded: number;
  totalOutstanding: number;
};

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
};

export default function SummaryPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch(`/api/summary?period=${period}`);
    const body = await res.json();
    setSummary(body.error ? null : body);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Summary</h2>

      <div className="mb-4 flex gap-2 rounded-full bg-gray-100 p-1">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`tap-target flex-1 rounded-full text-sm font-medium ${
              period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && summary && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Received" value={summary.ordersReceived} />
            <StatTile label="Delivered" value={summary.ordersDelivered} />
            <StatTile label="Cancelled" value={summary.ordersCancelled} />
          </div>

          <div className="rounded-xl2 border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Money received ({PERIOD_LABELS[period].toLowerCase()})</p>
              <p className="text-sm font-semibold text-brand-600">₹{summary.moneyReceived.toFixed(2)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <p className="text-sm text-gray-600">New receivables added ({PERIOD_LABELS[period].toLowerCase()})</p>
              <p className="text-sm font-semibold text-amber-600">₹{summary.receivablesAdded.toFixed(2)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <p className="text-sm font-medium text-gray-700">Total outstanding right now</p>
              <p className="text-base font-semibold text-gray-900">₹{summary.totalOutstanding.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !summary && (
        <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Couldn't load the summary.
        </p>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl2 border border-gray-200 bg-white p-3 text-center">
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
