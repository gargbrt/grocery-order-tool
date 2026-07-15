"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/errors";
import { PhoneInput, toE164 } from "@/components/PhoneInput";
import { PasswordInput } from "@/components/PasswordInput";
import { MIN_PASSWORD_LENGTH, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/passwordPolicy";

export default function SignupPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName, storeAddress, ownerName, ownerPhone: toE164(ownerPhone), password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(extractErrorMessage(body, "Couldn't create your store - please check the fields."));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Set up your store</h1>
        <p className="mb-6 text-sm text-gray-500">
          Takes a minute. You'll be the store owner - you can invite a helper afterward.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Store name</label>
            <input
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Sharma General Store"
              className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Store address (optional)</label>
            <input
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder="Main Market, Sector 12"
              className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Your name</label>
            <input
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Your phone number</label>
            <PhoneInput value={ownerPhone} onChange={setOwnerPhone} required />
            <p className="mt-1 text-xs text-gray-400">This is how you'll log in - not shown to customers.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-400">{PASSWORD_REQUIREMENTS_TEXT}</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="tap-target w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Creating your store…" : "Create my store"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have a store? <Link href="/login" className="text-brand-700 font-medium">Log in</Link>
        </p>
      </div>
    </main>
  );
}
