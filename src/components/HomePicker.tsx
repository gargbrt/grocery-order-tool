"use client";

import { useEffect, useState } from "react";
import { PhoneInput, fromE164 } from "./PhoneInput";

export type ContactSuggestion = { id: string; homeLabel: string; phone: string };

// Home label + phone fields with autocomplete against existing contacts.
// Typing filters a dropdown from either field; picking a suggestion fills
// both fields and reports the matched contact via onContactMatch. Typing
// something that doesn't match any existing Home is fine - callers that
// create orders already resolve/create the contact server-side by phone;
// callers that need an existing contact (e.g. recording a payment) should
// gate on onContactMatch being non-null before allowing submission.
export function HomePicker({
  homeLabel,
  phone,
  onHomeLabelChange,
  onPhoneChange,
  onContactMatch,
  homeLabelPlaceholder,
}: {
  homeLabel: string;
  phone: string;
  onHomeLabelChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onContactMatch?: (contact: ContactSuggestion | null) => void;
  homeLabelPlaceholder?: string;
}) {
  const [contacts, setContacts] = useState<ContactSuggestion[]>([]);
  const [activeField, setActiveField] = useState<"label" | "phone" | null>(null);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((body) => setContacts(body.contacts ?? []))
      .catch(() => {});
  }, []);

  function selectContact(c: ContactSuggestion) {
    onHomeLabelChange(c.homeLabel);
    onPhoneChange(fromE164(c.phone));
    onContactMatch?.(c);
    setActiveField(null);
  }

  function handleLabelChange(v: string) {
    onHomeLabelChange(v);
    onContactMatch?.(null);
    setActiveField("label");
  }

  function handlePhoneChange(v: string) {
    onPhoneChange(v);
    onContactMatch?.(null);
    setActiveField("phone");
  }

  const labelMatches =
    activeField === "label" && homeLabel.trim().length > 0
      ? contacts.filter((c) => c.homeLabel.toLowerCase().includes(homeLabel.trim().toLowerCase())).slice(0, 5)
      : [];

  const phoneMatches =
    activeField === "phone" && phone.trim().length > 0
      ? contacts.filter((c) => fromE164(c.phone).includes(phone.trim())).slice(0, 5)
      : [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          placeholder={homeLabelPlaceholder ?? "Home label (e.g. Sharma - Flat 4B)"}
          value={homeLabel}
          onChange={(e) => handleLabelChange(e.target.value)}
          onFocus={() => setActiveField("label")}
          onBlur={() => setTimeout(() => setActiveField((f) => (f === "label" ? null : f)), 150)}
          className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {labelMatches.length > 0 && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
            {labelMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => selectContact(c)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{c.homeLabel}</span>{" "}
                <span className="text-xs text-gray-500">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <PhoneInput value={phone} onChange={handlePhoneChange} />
        {phoneMatches.length > 0 && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
            {phoneMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => selectContact(c)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{c.homeLabel}</span>{" "}
                <span className="text-xs text-gray-500">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
