"use client";

import { useState } from "react";
import { RiUserAddLine } from "react-icons/ri";
import { toast } from "sonner";

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
    ? "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
    : "bg-[color:rgba(59,130,246,0.12)] text-[var(--accent-500)]";
}

export default function TeamManager(props: TeamManagerProps) {
  const { members, pendingInvites: initialPendingInvites, currentUserId } = props;
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "OWNER">("MEMBER");
  const [sending, setSending] = useState(false);

  const sendInvite = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSending(true);

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
      toast.success(`Invite sent to ${trimmedEmail}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rw-card p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Current Members</h2>
        <div className="mt-4 space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {member.user.name ?? member.user.email}
                  {member.user.id === currentUserId ? " (you)" : ""}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">{member.user.email}</p>
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

      <section className="rw-card p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending Invites</h2>
        <div className="mt-4 space-y-3">
          {pendingInvites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--text-secondary)]">
              No pending invites.
            </div>
          ) : (
            pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{invite.email}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Expires {formatDate(invite.expiresAt)}</p>
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

      <section className="rw-card p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Invite a teammate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            className="rw-input"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "MEMBER" | "OWNER")}
            className="rw-select"
          >
            <option value="MEMBER">MEMBER</option>
            <option value="OWNER">OWNER</option>
          </select>
          <button
            type="button"
            onClick={() => void sendInvite()}
            disabled={sending}
            className="rw-btn rw-btn-primary"
          >
            <RiUserAddLine size={16} />
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </section>
    </div>
  );
}
