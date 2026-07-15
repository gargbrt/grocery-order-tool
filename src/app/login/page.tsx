"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneInput, toE164 } from "@/components/PhoneInput";
import { PasswordInput } from "@/components/PasswordInput";
import { PASSWORD_REQUIREMENTS_TEXT } from "@/lib/passwordPolicy";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: toE164(phone), password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Store Orders</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to manage orders, billing & ledger</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
            <PhoneInput value={phone} onChange={setPhone} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <PasswordInput value={password} onChange={setPassword} required autoComplete="current-password" />
            <p className="mt-1 text-xs text-gray-400">{PASSWORD_REQUIREMENTS_TEXT}</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="tap-target w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          New store owner? <Link href="/signup" className="text-brand-700 font-medium">Create your store</Link>
        </p>
      </div>
    </main>
  );
}
