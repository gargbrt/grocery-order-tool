"use client";

import { useEffect, useState } from "react";

type Balance = { contactId: string; homeLabel: string; balance: number };

export default function LedgerPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((body) => {
        setBalances(body.balances ?? []);
        setLoading(false);
      });
  }, []);

  const totalOutstanding = balances.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Ledger</h2>
      <p className="mb-4 text-sm text-gray-500">Total outstanding: ₹{totalOutstanding.toFixed(2)}</p>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {balances
          .sort((a, b) => b.balance - a.balance)
          .map((b) => (
            <div
              key={b.contactId}
              className="flex items-center justify-between rounded-xl2 border border-gray-200 bg-white p-3"
            >
              <p className="font-medium text-gray-900">{b.homeLabel}</p>
              <p className={`text-sm font-semibold ${b.balance > 0 ? "text-amber-600" : "text-brand-600"}`}>
                ₹{b.balance.toFixed(2)}
              </p>
            </div>
          ))}
        {!loading && balances.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No ledger entries yet — they're created automatically when you finalize a bill.
          </p>
        )}
      </div>
    </div>
  );
}
