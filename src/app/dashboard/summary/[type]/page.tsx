"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { safeFetchJson } from "@/lib/safeFetch";
import { RetryBanner } from "@/components/RetryBanner";

type Entry = { contactId: string; homeLabel: string; amount: number; note: string | null; timestamp: string };

const TITLES: Record<string, string> = {
  "money-received": "Money received",
  "receivables-added": "New receivables added",
};

export default function SummaryEntriesPage() {
  const { type } = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? "daily";
  const rangeStart = searchParams.get("start");
  const rangeEnd = searchParams.get("end");
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ type, period });
    if (rangeStart) params.set("start", rangeStart);
    if (rangeEnd) params.set("end", rangeEnd);
    safeFetchJson<{ entries: Entry[] }>(`/api/summary/entries?${params.toString()}`).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setEntries(result.data.entries ?? []);
      setLoading(false);
    });
  }, [type, period, rangeStart, rangeEnd]);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 transform-gpu bg-[#f4f7fb] px-4 pb-3 pt-4">
        <button onClick={() => router.back()} className="mb-3 text-sm text-brand-700">
          ← Back
        </button>

        <h2 className="mb-1 text-lg font-semibold text-gray-900">{TITLES[type] ?? "Details"}</h2>
        <p className="text-sm text-gray-500">
          Total: ₹{total.toFixed(2)} · {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && error && <RetryBanner message={error} onRetry={() => router.refresh()} />}

      <div className="mt-3 space-y-2">
        {entries.map((e, i) => (
          <a
            key={`${e.contactId}-${e.timestamp}-${i}`}
            href={`/dashboard/ledger/${e.contactId}`}
            className="tap-target flex items-center justify-between rounded-xl2 border border-gray-200 bg-white p-3 active:scale-[0.99]"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{e.homeLabel}</p>
              {e.note && <p className="text-xs text-gray-500">{e.note}</p>}
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
        {!loading && !error && entries.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Nothing in this period yet.
          </p>
        )}
      </div>
    </div>
  );
}
