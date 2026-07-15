"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Balance = { contactId: string; homeLabel: string; balance: number; lastActivityAt: string | null };

const OVERDUE_DAYS = 30;

function isOverdue(b: Balance) {
  if (b.balance <= 0 || !b.lastActivityAt) return false;
  const ageMs = Date.now() - new Date(b.lastActivityAt).getTime();
  return ageMs > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}

export default function LedgerPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

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

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {balances
          .sort((a, b) => b.balance - a.balance)
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
