"use client";

import { useState } from "react";

// Password field with a show/hide eye-icon toggle, used everywhere a
// password is entered (login, signup, invite/reset flows).
export function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-lg text-gray-400"
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
