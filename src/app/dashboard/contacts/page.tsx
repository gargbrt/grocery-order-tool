"use client";

import { useEffect, useState } from "react";

type Contact = {
  id: string;
  homeLabel: string;
  phone: string;
  address: string | null;
  telegramChatId: string | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((body) => {
        setContacts(body.contacts ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Homes</h2>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="rounded-xl2 border border-gray-200 bg-white p-3">
            <p className="font-medium text-gray-900">{c.homeLabel}</p>
            <p className="text-xs text-gray-500">{c.phone}</p>
            {c.telegramChatId && <p className="mt-1 text-xs text-brand-600">✈️ Linked to Telegram</p>}
          </div>
        ))}
        {!loading && contacts.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Homes appear here automatically the first time a customer orders.
          </p>
        )}
      </div>
    </div>
  );
}
