"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiCheckboxCircleLine, RiErrorWarningLine } from "react-icons/ri";

import StandaloneShell from "@/components/ui/StandaloneShell";

type InviteAcceptClientProps = {
  token: string;
};

type AcceptState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function InviteAcceptClient({ token }: InviteAcceptClientProps) {
  const router = useRouter();
  const [state, setState] = useState<AcceptState>({
    status: "loading",
    message: "Accepting invite...",
  });

  useEffect(() => {
    let cancelled = false;

    async function acceptInvite() {
      try {
        const response = await fetch("/api/team/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to accept invite");
        }

        if (!cancelled) {
          setState({ status: "success", message: "Invite accepted." });
          window.setTimeout(() => router.replace("/dashboard/team"), 900);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to accept invite",
          });
        }
      }
    }

    void acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  const isError = state.status === "error";

  return (
    <StandaloneShell maxWidth="sm">
      <div className="text-center">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            isError
              ? "bg-[var(--error-bg)] text-[var(--error)]"
              : "bg-[var(--success-bg)] text-[var(--success)]"
          }`}
        >
          {isError ? (
            <RiErrorWarningLine className="h-6 w-6" />
          ) : (
            <RiCheckboxCircleLine className="h-6 w-6" />
          )}
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-[var(--text-primary)]">
          {isError ? "Invite could not be accepted" : "Joining workspace"}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{state.message}</p>

        {state.status === "loading" ? (
          <div className="mx-auto mt-8 h-7 w-7 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--accent-500)]" />
        ) : null}

        {isError ? (
          <Link href="/dashboard/team" className="rw-btn rw-btn-secondary mt-8 justify-center">
            Back to team
          </Link>
        ) : null}
      </div>
    </StandaloneShell>
  );
}
