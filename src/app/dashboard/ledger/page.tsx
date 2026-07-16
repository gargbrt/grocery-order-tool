"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OVERDUE_DAYS, isOverdue as isOverdueRaw } from "@/lib/ledgerOverdue";
import { safeFetchJson } from "@/lib/safeFetch";
import { RetryBanner } from "@/components/RetryBanner";

type Balance = {
  contactId: string;
  homeLabel: string;
  balance: number;
  lastActivityAt: string | null;
  totalOrderValue: number;
};

function isOverdue(b: Balance) {
  return isOverdueRaw(b.balance, b.lastActivityAt);
}

type SortMode = "amount" | "name" | "value";

const SORT_LABELS: Record<SortMode, string> = {
  amount: "Amount due",
  name: "A-Z",
  value: "Total order value",
};

function sortBalances(balances: Balance[], mode: SortMode): Balance[] {
  return [...balances].sort((a, b) => {
    if (mode === "name") return a.homeLabel.localeCompare(b.homeLabel);
    if (mode === "value") return b.totalOrderValue - a.totalOrderValue;
    return b.balance - a.balance;
  });
}

export default function LedgerPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("amount");

  async function load(silent = false) {
    if (!silent) setError(null);
    const result = await safeFetchJson<{ balances: Balance[] }>("/api/ledger");
    if (!result.ok) {
      if (!silent) {
        setError(result.error);
        setLoading(false);
      }
      return;
    }
    setBalances(result.data.balances ?? []);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const totalOutstanding = balances.reduce((sum, b) => sum + b.balance, 0);
  const overdueCount = balances.filter(isOverdue).length;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 transform-gpu bg-[#f4f7fb] px-4 pb-3 pt-4">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Ledger</h2>
        <p className="mb-1 text-sm text-gray-500">Total outstanding: ₹{totalOutstanding.toFixed(2)}</p>
        {overdueCount > 0 && (
          <p className="mb-3 text-sm font-medium text-red-600">
            ⚠ {overdueCount} account{overdueCount === 1 ? "" : "s"} overdue {OVERDUE_DAYS}+ days
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-gray-500">Sort by</span>
          <div className="flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1">
            {(["amount", "value", "name"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`tap-target shrink-0 rounded-full px-3 text-sm font-medium ${
                  sortMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && error && <RetryBanner message={error} onRetry={() => load()} />}

      <div className="mt-3 space-y-2">
        {sortBalances(balances, sortMode).map((b) => {
          const overdue = isOverdue(b);
          return (
            <Link
              key={b.contactId}
              href={`/dashboard/ledger/${b.contactId}`}
              className={`tap-target block rounded-xl2 border bg-white p-3 active:scale-[0.99] ${
                overdue ? "border-red-300" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{b.homeLabel}</p>
                <p className={`text-sm font-semibold ${b.balance > 0 ? "text-amber-600" : "text-brand-600"}`}>
                  ₹{b.balance.toFixed(2)}
                </p>
              </div>
              {sortMode === "value" && (
                <p className="mt-0.5 text-xs text-gray-500">Total order value: ₹{b.totalOrderValue.toFixed(2)}</p>
              )}
              {overdue && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  ⚠ Payment due for {OVERDUE_DAYS}+ days
                </p>
              )}
            </Link>
          );
        })}
        {!loading && balances.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No ledger entries yet — they're created automatically when you finalize a bill.
          </p>
        )}
      </div>
    </div>
  );
}
