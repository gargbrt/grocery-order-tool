"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/errors";
import { PhoneInput, toE164, fromE164 } from "@/components/PhoneInput";
import { safeFetchJson } from "@/lib/safeFetch";
import { RetryBanner } from "@/components/RetryBanner";

type Contact = {
  id: string;
  homeLabel: string;
  phone: string;
  address: string | null;
  notes: string | null;
  telegramChatId: string | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const result = await safeFetchJson<{ contacts: Contact[] }>("/api/contacts");
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setContacts(result.data.contacts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/session")
      .then((r) => r.json())
      .then((body) => setIsOwner(body.role === "OWNER"))
      .catch(() => setIsOwner(false));
  }, []);

  return (
    <div>
      <h2 className="sticky top-0 z-10 -mx-4 -mt-4 transform-gpu bg-[#f4f7fb] px-4 pb-3 pt-4 text-lg font-semibold text-gray-900">
        Homes
      </h2>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && error && <RetryBanner message={error} onRetry={load} />}
      <div className="mt-3 space-y-2">
        {contacts.map((c) => {
          const CardTag = isOwner ? "button" : "div";
          return (
            <CardTag
              key={c.id}
              onClick={isOwner ? () => setEditing(c) : undefined}
              className={`w-full rounded-xl2 border border-gray-200 bg-white p-3 text-left ${
                isOwner ? "tap-target active:scale-[0.99]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{c.homeLabel}</p>
                {isOwner && <span className="text-xs text-brand-600">Edit</span>}
              </div>
              <p className="text-xs text-gray-500">{c.phone}</p>
              {c.address && <p className="mt-0.5 text-xs text-gray-500">{c.address}</p>}
              {c.telegramChatId && <p className="mt-1 text-xs text-brand-600">✈️ Linked to Telegram</p>}
            </CardTag>
          );
        })}
        {!loading && contacts.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Homes appear here automatically the first time a customer orders.
          </p>
        )}
      </div>

      {editing && (
        <EditHomeModal contact={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function EditHomeModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [homeLabel, setHomeLabel] = useState(contact.homeLabel);
  const [phone, setPhone] = useState(fromE164(contact.phone));
  const [address, setAddress] = useState(contact.address ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeLabel, phone: toE164(phone), address: address || null, notes: notes || null }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(extractErrorMessage(body, "Couldn't save changes."));
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl2">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Edit Home</h3>
        <div className="space-y-3">
          <input
            placeholder="Home label"
            value={homeLabel}
            onChange={(e) => setHomeLabel(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <PhoneInput value={phone} onChange={setPhone} />
          <input
            placeholder="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
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
            disabled={submitting || !homeLabel || !phone}
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
