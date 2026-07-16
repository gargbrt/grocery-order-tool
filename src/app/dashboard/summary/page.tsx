"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { safeFetchJson } from "@/lib/safeFetch";
import { RetryBanner } from "@/components/RetryBanner";

type Period = "daily" | "weekly" | "monthly" | "fy" | "all" | "custom";

type TopCustomer = { contactId: string; homeLabel: string; totalOrderValue: number };

type CumulativeWithChange = { cumulative: number; change: number };

type Summary = {
  period: Period;
  range: { start: string; end: string };
  ordersReceived: number;
  ordersOpen: number;
  ordersDelivered: number;
  totalBilled: CumulativeWithChange;
  moneyReceived: CumulativeWithChange;
  totalOutstanding: CumulativeWithChange;
  topCustomers: TopCustomer[];
};

const PERIODS: Period[] = ["daily", "weekly", "monthly", "fy", "all", "custom"];

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  fy: "This financial year",
  all: "Overall",
  custom: "Custom range",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SummaryPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [customStart, setCustomStart] = useState(todayIso());
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodQuery =
    period === "custom" ? `period=custom&start=${customStart}&end=${customEnd}` : `period=${period}`;

  async function load(silent = false) {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const result = await safeFetchJson<Summary>(`/api/summary?${periodQuery}`);
    if (!result.ok) {
      if (!silent) {
        setError(result.error);
        setLoading(false);
      }
      return;
    }
    setSummary(result.data);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd]);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 transform-gpu bg-[#f4f7fb] px-4 pb-3 pt-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Summary</h2>

        <div className="flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`tap-target shrink-0 rounded-full px-3 text-sm font-medium ${
                period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="tap-target flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={todayIso()}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="tap-target flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && error && <RetryBanner message={error} onRetry={() => load()} />}

      {!loading && !error && summary && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <StatTile href="/dashboard" label="Received" value={summary.ordersReceived} />
            <StatTile href="/dashboard?category=open" label="Open" value={summary.ordersOpen} />
            <StatTile href="/dashboard?category=delivered" label="Delivered" value={summary.ordersDelivered} />
          </div>

          <div className="overflow-hidden rounded-xl2 border border-gray-200 bg-white">
            <MoneyRow label="Total billed" cumulative={summary.totalBilled} periodLabel={PERIOD_LABELS[period]} />
            <MoneyRow
              label="Money received"
              cumulative={summary.moneyReceived}
              periodLabel={PERIOD_LABELS[period]}
              href={`/dashboard/summary/money-received?${periodQuery}`}
              bordered
            />
            <MoneyRow
              label="Net receivables / Total outstanding"
              cumulative={summary.totalOutstanding}
              periodLabel={PERIOD_LABELS[period]}
              href="/dashboard/ledger"
              bordered
            />
          </div>
          <p className="px-1 text-xs text-gray-400">
            Each row's big number is the cumulative total as of right now; the smaller line below is how much it
            moved in the selected period. "Total outstanding" won't simply equal "total billed" minus "money
            received" for a period - money received includes cash paid immediately at delivery, which was never
            added to anyone's balance in the first place.
          </p>

          <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-700">Top customers (all-time order value)</h3>
          <div className="overflow-hidden rounded-xl2 border border-gray-200 bg-white">
            {summary.topCustomers.map((c, i) => (
              <Link
                key={c.contactId}
                href={`/dashboard/ledger/${c.contactId}`}
                className={`tap-target flex items-center justify-between p-3 active:bg-gray-50 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <p className="text-sm text-gray-900">
                  <span className="mr-2 text-xs text-gray-400">#{i + 1}</span>
                  {c.homeLabel}
                </p>
                <p className="text-sm font-semibold text-gray-900">₹{c.totalOrderValue.toFixed(2)}</p>
              </Link>
            ))}
            {summary.topCustomers.length === 0 && (
              <p className="p-3 text-center text-sm text-gray-500">No billed orders yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="tap-target block rounded-xl2 border border-gray-200 bg-white p-3 text-center active:bg-gray-50">
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Link>
  );
}

function MoneyRow({
  label,
  cumulative,
  periodLabel,
  href,
  bordered,
}: {
  label: string;
  cumulative: CumulativeWithChange;
  periodLabel: string;
  href?: string;
  bordered?: boolean;
}) {
  const changeSign = cumulative.change > 0 ? "+" : cumulative.change < 0 ? "-" : "";
  const changeText = `${changeSign}₹${Math.abs(cumulative.change).toFixed(2)} ${periodLabel.toLowerCase()}`;
  const rowClass = `flex items-center justify-between p-3 ${bordered ? "border-t border-gray-100" : ""} ${
    href ? "tap-target active:bg-gray-50" : ""
  }`;
  const content = (
    <>
      <p className="text-sm text-gray-600">{label}</p>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900">₹{cumulative.cumulative.toFixed(2)}</p>
        <p className="text-xs text-gray-400">{changeText}</p>
      </div>
    </>
  );
  return href ? (
    <Link href={href} className={rowClass}>
      {content}
    </Link>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}
