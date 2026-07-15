"use client";

import { useEffect, useState } from "react";

type TeamMember = {
  id: string;
  name: string;
  phone: string;
  role: "OWNER" | "HELPER";
  canViewPricing: boolean;
  canViewContactDetails: boolean;
};

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/team");
    const body = await res.json();
    setTeam(body.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Team</h2>
        <button
          onClick={() => setShowInvite(true)}
          className="tap-target rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Invite helper
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {team.map((member) => (
          <div key={member.id} className="rounded-xl2 border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">{member.name}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{member.role}</span>
            </div>
            <p className="text-xs text-gray-500">{member.phone}</p>
            {member.role === "HELPER" && (
              <p className="mt-1 text-xs text-gray-400">
                {member.canViewPricing ? "Can see pricing" : "Pricing hidden"} ·{" "}
                {member.canViewContactDetails ? "Can see contact details" : "Contact details hidden"}
              </p>
            )}
          </div>
        ))}
      </div>

      {showInvite && <InviteHelperModal onClose={() => setShowInvite(false)} onCreated={load} />}
    </div>
  );
}

function InviteHelperModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [canViewPricing, setCanViewPricing] = useState(false);
  const [canViewContactDetails, setCanViewContactDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, password, canViewPricing, canViewContactDetails }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.[0] || body.error || "Couldn't create the helper account.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl2">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Invite a helper</h3>
        <div className="space-y-3">
          <input
            placeholder="Helper's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Phone (+9198XXXXXXXX)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Set a password for them"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={canViewPricing} onChange={(e) => setCanViewPricing(e.target.checked)} />
            Can see item pricing
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={canViewContactDetails}
              onChange={(e) => setCanViewContactDetails(e.target.checked)}
            />
            Can see customer phone numbers/addresses
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
            disabled={submitting || !name || !phone || password.length < 8}
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create login"}
          </button>
        </div>
      </div>
    </div>
  );
}
