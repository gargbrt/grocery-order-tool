"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/errors";
import { PhoneInput, toE164, fromE164 } from "@/components/PhoneInput";
import { PasswordInput } from "@/components/PasswordInput";
import { MIN_PASSWORD_LENGTH, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/passwordPolicy";
import { safeFetchJson } from "@/lib/safeFetch";
import { RetryBanner } from "@/components/RetryBanner";

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
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const result = await safeFetchJson<{ users: TeamMember[] }>("/api/team");
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setTeam(result.data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex transform-gpu items-center justify-between bg-[#f4f7fb] px-4 pb-3 pt-4">
        <h2 className="text-lg font-semibold text-gray-900">Team</h2>
        <button
          onClick={() => setShowInvite(true)}
          className="tap-target rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Invite helper
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && error && <RetryBanner message={error} onRetry={load} />}

      <div className="mt-3 space-y-2">
        {team.map((member) => (
          <button
            key={member.id}
            onClick={() => setEditing(member)}
            className="tap-target block w-full rounded-xl2 border border-gray-200 bg-white p-3 text-left active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">{member.name}</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{member.role}</span>
                <span className="text-xs text-brand-600">Edit</span>
              </div>
            </div>
            <p className="text-xs text-gray-500">{member.phone}</p>
            {member.role === "HELPER" && (
              <p className="mt-1 text-xs text-gray-400">
                {member.canViewPricing ? "Can see pricing" : "Pricing hidden"} ·{" "}
                {member.canViewContactDetails ? "Can see contact details" : "Contact details hidden"}
              </p>
            )}
          </button>
        ))}
      </div>

      {showInvite && <InviteHelperModal onClose={() => setShowInvite(false)} onCreated={load} />}
      {editing && (
        <EditTeamMemberModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
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
      body: JSON.stringify({ name, phone: toE164(phone), password, canViewPricing, canViewContactDetails }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(extractErrorMessage(body, "Couldn't create the helper account."));
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
          <PhoneInput value={phone} onChange={setPhone} />
          <div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Set a password for them"
              minLength={MIN_PASSWORD_LENGTH}
            />
            <p className="mt-1 text-xs text-gray-400">{PASSWORD_REQUIREMENTS_TEXT}</p>
          </div>
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
            disabled={submitting || !name || !phone || password.length < MIN_PASSWORD_LENGTH}
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create login"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTeamMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: TeamMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(fromE164(member.phone));
  const [canViewPricing, setCanViewPricing] = useState(member.canViewPricing);
  const [canViewContactDetails, setCanViewContactDetails] = useState(member.canViewContactDetails);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: toE164(phone),
        canViewPricing,
        canViewContactDetails,
        newPassword: showResetPassword && newPassword ? newPassword : undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(extractErrorMessage(body, "Couldn't save changes."));
      return;
    }
    onSaved();
  }

  async function deleteHelper() {
    if (!window.confirm(`Remove ${member.name}'s login? They won't be able to sign in anymore. Their past orders/activity stay on record.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/team/${member.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(extractErrorMessage(body, "Couldn't remove this helper."));
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl2">
        <h3 className="mb-3 text-base font-semibold text-gray-900">
          Edit {member.role === "OWNER" ? "your" : "helper's"} info
        </h3>
        <div className="space-y-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tap-target w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <PhoneInput value={phone} onChange={setPhone} />
          {member.role === "HELPER" && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={canViewPricing}
                  onChange={(e) => setCanViewPricing(e.target.checked)}
                />
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
            </>
          )}

          {!showResetPassword ? (
            <button
              onClick={() => setShowResetPassword(true)}
              className="tap-target w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
            >
              Reset password
            </button>
          ) : (
            <div>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password"
                minLength={MIN_PASSWORD_LENGTH}
              />
              <p className="mt-1 text-xs text-gray-400">{PASSWORD_REQUIREMENTS_TEXT}</p>
            </div>
          )}
          <p className="text-xs text-gray-400">
            Passwords are stored securely and can't be viewed, even by you - use "Reset password" above to set a new
            one if {member.role === "OWNER" ? "you forget yours" : "they forget theirs"}.
          </p>

          {member.role === "HELPER" && (
            <button
              onClick={deleteHelper}
              disabled={deleting}
              className="tap-target w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              {deleting ? "Removing…" : "Remove helper login"}
            </button>
          )}

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
            disabled={
              submitting ||
              !name ||
              !phone ||
              (showResetPassword && newPassword.length < MIN_PASSWORD_LENGTH)
            }
            className="tap-target flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
