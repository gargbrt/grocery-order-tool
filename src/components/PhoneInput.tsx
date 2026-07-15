"use client";

// Fixed +91 prefix, user only ever types the local 10-digit number. Combine
// with `+91${value}` when sending to the API. Centralized so every phone
// field in the app stores/expects the same E.164-ish format - a past bug
// came from some forms not enforcing this and the phone silently not
// matching what login expects.
export function PhoneInput({
  value,
  onChange,
  placeholder = "98XXXXXXXX",
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <span className="tap-target flex items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-base text-gray-600">
        +91
      </span>
      <input
        type="tel"
        required={required}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder={placeholder}
        className="tap-target w-full min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

export function toE164(localNumber: string) {
  return `+91${localNumber}`;
}

// Inverse of toE164, for prefilling an edit form from a stored phone value.
// Falls back to the raw value unchanged if it doesn't look like +91-prefixed
// (e.g. a Telegram-only contact's "telegram:<chatId>" placeholder) - so the
// owner sees it's not a real number yet and knows to type one in fresh.
export function fromE164(phone: string) {
  return phone.startsWith("+91") ? phone.slice(3) : phone;
}
