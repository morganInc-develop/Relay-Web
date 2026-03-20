"use client";

import { useState } from "react";

interface TeamManagerProps {
  siteId: string;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }>;
  pendingInvites: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
  }>;
  currentUserId: string;
}

interface InviteResponse {
  success?: boolean;
  error?: string;
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleString();
}

function roleBadgeClass(role: string): string {
  return role === "OWNER"
    ? "bg-slate-100 text-slate-700"
    : "bg-blue-50 text-blue-700";
}

export default function TeamManager(props: TeamManagerProps) {
  const { members, pendingInvites: initialPendingInvites, currentUserId } = props;
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "OWNER">("MEMBER");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const sendInvite = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setToast({ kind: "error", message: "Enter a valid email address." });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSending(true);
    setToast(null);

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, role }),
      });

      const data = (await response.json()) as InviteResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to send invite");
      }

      setPendingInvites((current) => [
        {
          id: `pending-${crypto.randomUUID()}`,
          email: trimmedEmail.toLowerCase(),
          role,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        ...current,
      ]);
      setEmail("");
      setRole("MEMBER");
      setToast({ kind: "success", message: `Invite sent to ${trimmedEmail}` });
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to send invite",
      });
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="relative space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Current Members</h2>
        <div className="mt-4 space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {member.user.name ?? member.user.email}
                  {member.user.id === currentUserId ? " (you)" : ""}
                </p>
                <p className="text-sm text-slate-500">{member.user.email}</p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(member.role)}`}
              >
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Pending Invites</h2>
        <div className="mt-4 space-y-3">
          {pendingInvites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No pending invites.
            </div>
          ) : (
            pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                  <p className="text-xs text-slate-500">Expires {formatDate(invite.expiresAt)}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(invite.role)}`}
                >
                  {invite.role}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Invite a teammate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "MEMBER" | "OWNER")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="MEMBER">MEMBER</option>
            <option value="OWNER">OWNER</option>
          </select>
          <button
            type="button"
            onClick={() => void sendInvite()}
            disabled={sending}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </section>

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 rounded-md px-3 py-2 text-xs font-medium shadow-sm ${
            toast.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
