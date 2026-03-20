"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RiAlertLine } from "react-icons/ri";

import StandaloneShell from "@/components/ui/StandaloneShell";

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already associated with another sign in method",
  AccessDenied: "You do not have permission to sign in",
  Configuration: "There is a problem with the server configuration.",
  Verification: "The verification token has expired or has already been used.",
  OAuthSignin: "Error in constructing an authorization URL.",
  OAuthCallback: "Error in handling the response from the OAuth provider.",
  OAuthCreateAccount: "Could not create OAuth provider user in the database.",
  EmailCreateAccount: "Could not create email provider user in the database.",
  Callback: "Error in the OAuth callback handler route.",
  Default: "An unknown error occurred.",
};

function ErrorDetails() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "";
  const message = errorMessages[error] ?? "An error occurred during sign in. Please try again.";
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    void error;
  }, [error]);

  return (
    <div className="mt-6 space-y-4 text-left">
      <div className="rounded-xl border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
        {message}
      </div>

      {error ? (
        <div className="rw-card p-4">
          <p className="rw-kicker">Error Code</p>
          <p className="mt-2 font-medium text-[var(--text-primary)]">{error}</p>
        </div>
      ) : null}

      {error === "OAuthCallback" && origin ? (
        <div className="rw-card p-4 text-sm text-[var(--text-secondary)]">
          Confirm this redirect URI exists in Google Cloud:
          <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]">
            {origin}/api/auth/callback/google
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <StandaloneShell maxWidth="md">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:rgba(239,68,68,0.22)] bg-[var(--error-bg)]">
          <RiAlertLine className="h-8 w-8 text-[var(--error)]" />
        </div>
        <span className="rw-eyebrow mt-6 justify-center">Relay Web</span>
        <h1 className="mt-5 text-3xl font-semibold text-[var(--text-primary)]">
          Sign-in error
        </h1>
        <Suspense fallback={<p className="mt-4 text-sm text-[var(--text-secondary)]">Loading error details...</p>}>
          <ErrorDetails />
        </Suspense>
        <Link
          href="/auth/signin"
          className="rw-btn rw-btn-primary mt-8 w-full justify-center"
        >
          Try again
        </Link>
      </div>
    </StandaloneShell>
  );
}
