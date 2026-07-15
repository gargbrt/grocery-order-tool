"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OVERDUE_DAYS, isOverdue as isOverdueRaw } from "@/lib/ledgerOverdue";

type Balance = { contactId: string; homeLabel: string; balance: number; lastActivityAt: string | null };

function isOverdue(b: Balance) {
  return isOverdueRaw(b.balance, b.lastActivityAt);
}

type SortMode = "amount" | "name";

export default function LedgerPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("amount");

  async function load(silent = false) {
    const res = await fetch("/api/ledger");
    const body = await res.json();
    setBalances(body.balances ?? []);
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
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Ledger</h2>
      <p className="mb-1 text-sm text-gray-500">Total outstanding: ₹{totalOutstanding.toFixed(2)}</p>
      {overdueCount > 0 && (
        <p className="mb-4 text-sm font-medium text-red-600">
          ⚠ {overdueCount} account{overdueCount === 1 ? "" : "s"} overdue {OVERDUE_DAYS}+ days
        </p>
      )}
      {overdueCount === 0 && <div className="mb-4" />}

      <div className="mb-3 flex gap-2 rounded-full bg-gray-100 p-1">
        <button
          onClick={() => setSortMode("amount")}
          className={`tap-target flex-1 rounded-full text-sm font-medium ${
            sortMode === "amount" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Sort: Amount due
        </button>
        <button
          onClick={() => setSortMode("name")}
          className={`tap-target flex-1 rounded-full text-sm font-medium ${
            sortMode === "name" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Sort: A-Z
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {[...balances]
          .sort((a, b) =>
            sortMode === "name" ? a.homeLabel.localeCompare(b.homeLabel) : b.balance - a.balance
          )
          .map((b) => {
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
